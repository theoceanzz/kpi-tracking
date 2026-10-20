package com.kpitracking.service.reward;

import com.kpitracking.dto.response.reward.RewardCelebrationResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.RewardGrant;
import com.kpitracking.entity.RewardGrantItem;
import com.kpitracking.entity.RewardProgramRun;
import com.kpitracking.entity.RewardProgramRunItem;
import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.entity.User;
import com.kpitracking.enums.RewardCelebrationSource;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.RewardGrantItemRepository;
import com.kpitracking.repository.RewardProgramRunItemRepository;
import com.kpitracking.repository.RewardRedemptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Lượt thưởng / đổi quà CHƯA được ăn mừng của người đang đăng nhập — nguồn sự thật cho hiệu ứng chúc
 * mừng ở frontend (pháo hoa, hộp chúc mừng, giấy khen trượt vào).
 *
 * <h2>Một luồng cho cả online lẫn offline</h2>
 * WebSocket ({@code /user/queue/celebrations}, xem {@code RewardCelebrationSignalListener}) chỉ là tín hiệu
 * "có thưởng mới". Frontend nhận tín hiệu — hoặc lúc mở app — thì gọi {@link #listMine()}, diễn hiệu ứng,
 * rồi {@link #acknowledge(Collection)}. Nhờ vậy:
 * <ul>
 *   <li>người offline lúc được thưởng vẫn được ăn mừng bù lần tới mở app;</li>
 *   <li>mỗi lượt chỉ ăn mừng MỘT lần dù mở nhiều tab / nhiều máy (frontend lấy + ack trong cùng một Web
 *       Lock; ack chỉ ghi dòng còn trống nên gọi trùng không đổi gì).</li>
 * </ul>
 *
 * <h2>Lượt nào được ăn mừng</h2>
 * <ul>
 *   <li>Thưởng tay: đề nghị đã duyệt và đã phát điểm. Bị thu hồi trước khi người nhận kịp xem ⇒ đề nghị
 *       sang {@code REVOKED}, không còn trong danh sách — không bao giờ ăn mừng điểm đã bị trừ.</li>
 *   <li>Chương trình tự động: lần chạy {@code ISSUED} (đã hoàn tác ⇒ {@code REVERTED}, bị loại).</li>
 *   <li>Đổi quà: đơn được NGƯỜI KHÁC duyệt hoặc giao. Đơn xong ngay trong request của chính người đổi đã
 *       được đánh dấu lúc lưu (người đó vừa thấy hiệu ứng trên màn hình rồi).</li>
 * </ul>
 * Người thưởng cũng là người nhận (tự đứng tên trong danh sách nhận) được ăn mừng y như mọi người nhận
 * khác — cố ý KHÔNG lọc theo người thưởng, để một lượt thưởng luôn được thể hiện giống nhau với mọi người nhận.
 *
 * <p>Chỉ lấy lượt trong {@link #WINDOW} gần nhất: ai nghỉ dài ngày quay lại không bị pháo cho cả quý.
 * Tổ chức tắt tính năng thưởng ⇒ danh sách rỗng.
 */
@Service
@RequiredArgsConstructor
public class RewardCelebrationService {

    /** Chỉ ăn mừng bù lượt trong khoảng này. */
    static final Duration WINDOW = Duration.ofDays(30);
    /** Trần mỗi nguồn mỗi lần lấy — hộp chúc mừng gộp lại, không cần nhiều hơn. */
    private static final int MAX_PER_SOURCE = 50;

    private final RewardContext context;
    private final OrganizationRepository organizationRepository;
    private final RewardGrantItemRepository grantItemRepository;
    private final RewardProgramRunItemRepository runItemRepository;
    private final RewardRedemptionRepository redemptionRepository;
    private final RewardGrantService grantService;

    @Transactional(readOnly = true)
    public List<RewardCelebrationResponse> listMine() {
        User me = context.getCurrentUser();
        UUID orgId = orgIdOrNull(me);
        if (orgId == null || !rewardEnabled(orgId)) return List.of();

        Instant since = Instant.now().minus(WINDOW);
        PageRequest cap = PageRequest.of(0, MAX_PER_SOURCE);
        List<RewardCelebrationResponse> out = new ArrayList<>();

        for (RewardGrantItem item : grantItemRepository.findUncelebrated(me.getId(), orgId, since, cap)) {
            RewardGrant grant = item.getGrant();
            boolean certificate = Boolean.TRUE.equals(grant.getCertificateEnabled());
            out.add(RewardCelebrationResponse.builder()
                    .source(RewardCelebrationSource.GRANT)
                    .refId(grant.getId())
                    .points(item.getPoints())
                    .occurredAt(grant.getApprovedAt() != null ? grant.getApprovedAt() : item.getCreatedAt())
                    .grantorName(grant.getGrantor().getFullName())
                    .reason(grant.getReason())
                    .certificate(certificate)
                    .grant(certificate ? grantService.toRecipientView(grant, item) : null)
                    .build());
        }

        for (RewardProgramRunItem item : runItemRepository.findUncelebrated(me.getId(), orgId, since, cap)) {
            RewardProgramRun run = item.getRun();
            out.add(RewardCelebrationResponse.builder()
                    .source(RewardCelebrationSource.PROGRAM_RUN)
                    .refId(run.getId())
                    .points(item.getPoints())
                    .occurredAt(run.getExecutedAt() != null ? run.getExecutedAt() : item.getCreatedAt())
                    .programName(run.getProgram().getName())
                    .rank(item.getRank())
                    .build());
        }

        for (RewardRedemption r : redemptionRepository.findUncelebrated(me.getId(), orgId, since, cap)) {
            out.add(RewardCelebrationResponse.builder()
                    .source(RewardCelebrationSource.REDEMPTION)
                    .refId(r.getId())
                    .points(r.getPointsSpent())
                    .occurredAt(firstNonNull(r.getHandledAt(), r.getDeliveredAt(), r.getUpdatedAt()))
                    .giftName(r.getGiftNameSnapshot())
                    .giftImageUrl(r.getGiftImageSnapshot())
                    .redemptionStatus(r.getStatus())
                    .quantity(r.getQuantity())
                    .build());
        }

        out.sort(Comparator.comparing(RewardCelebrationResponse::getOccurredAt,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    /**
     * Đánh dấu đã ăn mừng. Chỉ chạm dòng của CHÍNH người gọi và chỉ dòng còn trống ⇒ idempotent; id lạ, id
     * của người khác, id đã ack đều bị bỏ qua lặng lẽ (không lộ việc id đó có tồn tại hay không).
     *
     * @return số dòng vừa được đánh dấu (0 khi gọi lại)
     */
    @Transactional
    public int acknowledge(Collection<UUID> refIds) {
        if (refIds == null || refIds.isEmpty()) return 0;
        UUID me = context.getCurrentUser().getId();
        Instant now = Instant.now();
        // id ba nguồn là UUID ngẫu nhiên, không trùng nhau giữa các bảng — chạy cả ba câu với cùng danh sách.
        return grantItemRepository.markCelebrated(me, refIds, now)
                + runItemRepository.markCelebrated(me, refIds, now)
                + redemptionRepository.markCelebrated(me, refIds, now);
    }

    private UUID orgIdOrNull(User me) {
        try {
            return context.getOrgIdOf(me.getId());
        } catch (RuntimeException e) {
            // Chưa thuộc tổ chức nào (vd. quản trị nền tảng): không có gì để ăn mừng, không phải lỗi.
            return null;
        }
    }

    private boolean rewardEnabled(UUID orgId) {
        return organizationRepository.findById(orgId)
                .map(Organization::getEnableReward)
                .map(Boolean.TRUE::equals)
                .orElse(false);
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... values) {
        for (T v : values) if (v != null) return v;
        return null;
    }
}
