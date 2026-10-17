package com.kpitracking.ai.submission.review;

import com.kpitracking.entity.ai.AiSubmissionReview;
import com.kpitracking.entity.ai.AiSubmissionReviewItem;
import com.kpitracking.enums.ai.AiReviewStatus;
import com.kpitracking.repository.ai.AiSubmissionReviewItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Kết quả AI HIỆN HÀNH của một người trong một đợt, gộp từ nhiều lượt: từ 06/10 một lượt có thể chỉ chấm vài chỉ tiêu
 * (nút "Gợi ý" ở từng dòng), nên "lượt mới nhất" không còn là bức tranh đủ. Mỗi chỉ tiêu lấy item của lượt
 * {@code DONE} MỚI NHẤT có chấm chỉ tiêu đó; phần chung (tóm tắt, thiếu dữ liệu, trọng số) lấy từ lượt cả phiếu
 * {@code DONE} mới nhất.
 *
 * <p>Dùng chung cho màn chấm ({@code SubmissionReviewService#latest}) và báo cáo lệch AI – quản lý — cùng một cách
 * gộp, để tổng điểm của báo cáo không tụt về một chỉ tiêu khi lượt mới nhất chỉ chấm lẻ một bài.
 */
@Component
@RequiredArgsConstructor
public class AiReviewLatestView {

    private final AiSubmissionReviewItemRepository itemRepository;

    /**
     * @param base              lượt cung cấp phần chung: lượt cả phiếu DONE mới nhất → lượt DONE mới nhất → lượt đã
     *                          xong (kể cả lỗi) mới nhất → lượt mới nhất
     * @param status            trạng thái hiển thị: lượt cả phiếu đang chạy thì là trạng thái của nó, không thì của {@code base}.
     *                          Ô từng chỉ tiêu KHÔNG dựa vào đây mà dựa vào {@code runningCriteriaIds}
     * @param items             item hiện hành, mỗi chỉ tiêu một item
     * @param runOfCriterion    lượt đã chấm item hiện hành của từng chỉ tiêu
     * @param fullRunInFlight   có lượt cả phiếu đang xếp hàng / chạy (mọi chỉ tiêu coi như đang chấm)
     * @param runningCriteriaIds chỉ tiêu đang chấm: của các lượt lẻ đang chạy, cộng mọi chỉ tiêu của phiếu khi còn lượt
     *                          cả phiếu cũ chạy dở
     * @param failedCriteriaIds chỉ tiêu mà lượt lẻ mới nhất lỗi, mới hơn kết quả đang có
     */
    public record View(AiSubmissionReview base, AiReviewStatus status, List<AiSubmissionReviewItem> items,
                       Map<UUID, AiSubmissionReview> runOfCriterion, boolean fullRunInFlight,
                       Set<UUID> runningCriteriaIds, Set<UUID> failedCriteriaIds) {

        public boolean isRunning(UUID kpiCriteriaId) {
            return fullRunInFlight || runningCriteriaIds.contains(kpiCriteriaId);
        }

        public AiSubmissionReviewItem itemOf(UUID kpiCriteriaId) {
            return items.stream().filter(i -> kpiCriteriaId.equals(i.getKpiCriteriaId())).findFirst().orElse(null);
        }
    }

    /** Gộp các lượt (mới nhất trước) của MỘT người trong MỘT đợt; không có lượt nào thì {@code null}. */
    public View of(List<AiSubmissionReview> runsNewestFirst) {
        return of(runsNewestFirst, null);
    }

    /**
     * Như {@link #of(List)} nhưng chỉ giữ item của các chỉ tiêu trong {@code keep} (chỉ tiêu còn trên phiếu AI) — kết
     * quả cũ của chỉ tiêu nay đã xin tạm dừng không hiện nữa. {@code null} = giữ hết.
     */
    public View of(List<AiSubmissionReview> runsNewestFirst, Set<UUID> keep) {
        if (runsNewestFirst == null || runsNewestFirst.isEmpty()) return null;

        List<AiSubmissionReview> done = runsNewestFirst.stream().filter(r -> r.getStatus() == AiReviewStatus.DONE).toList();
        AiSubmissionReview inFlightFull = runsNewestFirst.stream()
                .filter(r -> inFlight(r) && isFull(r)).findFirst().orElse(null);
        Set<UUID> running = new LinkedHashSet<>();
        runsNewestFirst.stream().filter(r -> inFlight(r) && !isFull(r)).forEach(r -> running.addAll(scopeOf(r)));

        // Lượt cả phiếu cũ còn chạy dở: báo theo TỪNG chỉ tiêu, không qua trạng thái chung.
        if (inFlightFull != null && keep != null) running.addAll(keep);

        Merged merged = merge(done, keep);
        // Ưu tiên lượt đã xong làm "nền": nếu lấy lượt lẻ vừa xếp hàng thì trạng thái chung thành QUEUED và màn chấm
        // tưởng cả phiếu đang chấm (06/10: bấm Gợi ý một ô, mọi ô cùng quay).
        AiSubmissionReview base = done.stream().filter(AiReviewLatestView::isFull).findFirst()
                .or(() -> done.stream().findFirst())
                .or(() -> runsNewestFirst.stream().filter(r -> !inFlight(r)).findFirst())
                .orElse(runsNewestFirst.get(0));

        // Lượt lẻ lỗi mà mới hơn kết quả đang có của chỉ tiêu → ô đó hiện "Thử lại" thay vì im lặng.
        Set<UUID> failed = new LinkedHashSet<>();
        for (AiSubmissionReview r : runsNewestFirst) {
            if (r.getStatus() != AiReviewStatus.FAILED || isFull(r)) continue;
            for (UUID id : scopeOf(r)) {
                AiSubmissionReview okRun = merged.runOfCriterion().get(id);
                if (!running.contains(id) && (okRun == null || okRun.getCreatedAt().isBefore(r.getCreatedAt()))) failed.add(id);
            }
        }

        AiReviewStatus status = inFlightFull != null ? inFlightFull.getStatus() : base.getStatus();
        return new View(base, status, merged.items(), merged.runOfCriterion(), inFlightFull != null, running, failed);
    }

    /** Item hiện hành của mỗi chỉ tiêu và lượt đã chấm nó, gộp từ các lượt DONE (mới nhất trước). */
    public record Merged(List<AiSubmissionReviewItem> items, Map<UUID, AiSubmissionReview> runOfCriterion) {}

    public Merged merge(List<AiSubmissionReview> doneNewestFirst) {
        return merge(doneNewestFirst, null);
    }

    /** @param keep chỉ giữ item của các chỉ tiêu này; {@code null} = giữ hết */
    public Merged merge(List<AiSubmissionReview> doneNewestFirst, Set<UUID> keep) {
        if (doneNewestFirst.isEmpty()) return new Merged(List.of(), Map.of());
        Map<UUID, List<AiSubmissionReviewItem>> byRun = itemRepository
                .findAllByReviewIdIn(doneNewestFirst.stream().map(AiSubmissionReview::getId).toList()).stream()
                .collect(Collectors.groupingBy(AiSubmissionReviewItem::getReviewId));
        Map<UUID, AiSubmissionReviewItem> items = new LinkedHashMap<>();
        Map<UUID, AiSubmissionReview> runOf = new HashMap<>();
        for (AiSubmissionReview r : doneNewestFirst) {
            for (AiSubmissionReviewItem i : byRun.getOrDefault(r.getId(), List.of())) {
                if (keep != null && !keep.contains(i.getKpiCriteriaId())) continue;
                if (items.putIfAbsent(i.getKpiCriteriaId(), i) == null) runOf.put(i.getKpiCriteriaId(), r);
            }
        }
        return new Merged(List.copyOf(items.values()), runOf);
    }

    // ── phạm vi của lượt ─────────────────────────────────────────────────────

    public static boolean isFull(AiSubmissionReview r) {
        return r.getScopeCriteriaIds() == null || r.getScopeCriteriaIds().isBlank();
    }

    public static Set<UUID> scopeOf(AiSubmissionReview r) {
        if (isFull(r)) return Set.of();
        return Arrays.stream(r.getScopeCriteriaIds().split("\n")).map(String::strip).filter(s -> !s.isEmpty())
                .map(UUID::fromString).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public static String scopeColumn(Collection<UUID> ids) {
        return ids == null || ids.isEmpty() ? null : ids.stream().map(UUID::toString).collect(Collectors.joining("\n"));
    }

    public static boolean inFlight(AiSubmissionReview r) {
        return r.getStatus() == AiReviewStatus.QUEUED || r.getStatus() == AiReviewStatus.RUNNING;
    }
}
