package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.CompositionResponses.*;
import com.kpitracking.repository.BscWeightHistoryRepository;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import com.kpitracking.service.BscAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm biểu đồ THÀNH PHẦN và THAY ĐỔI THEO THỜI GIAN.
 *
 * <p>Phạm vi lấy từ {@link StatsTierResolver}, phân giải đúng một lần đầu mỗi phương thức.
 */
@Service
@RequiredArgsConstructor
public class CompositionAnalyticsService {

    /** Thứ tự trạng thái bài nộp trong biểu đồ chồng: từ chưa xong đến đã xong. */
    private static final List<String> SUBMISSION_STATUSES = List.of("DRAFT", "PENDING", "REJECTED", "APPROVED");

    private static final Map<String, String> STATUS_LABELS = Map.of(
            "DRAFT", "Nháp",
            "PENDING", "Chờ duyệt",
            "REJECTED", "Từ chối",
            "APPROVED", "Đã duyệt");

    private static final Map<String, String> STATUS_COLORS = Map.of(
            "DRAFT", "#94a3b8",
            "PENDING", "#f59e0b",
            "REJECTED", "#ef4444",
            "APPROVED", "#10b981");

    private final StatsTierResolver tierResolver;
    private final KpiSubmissionRepository submissionRepository;
    private final EvaluationPerspectiveScoreRepository perspectiveScoreRepository;
    private final BscWeightHistoryRepository weightHistoryRepository;
    private final BscAnalyticsService bscAnalyticsService;

    // ============================================================
    // T1 - Cơ cấu bài nộp theo thời gian
    // ============================================================

    @Transactional(readOnly = true)
    public SubmissionCompositionResponse getSubmissionComposition(UUID orgUnitId, Collection<UUID> periodIds,
                                                                  Instant from, Instant to) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty()) {
            return SubmissionCompositionResponse.builder()
                    .statuses(statusMetas()).points(List.of()).totalCount(0).build();
        }

        // Không có mốc thời gian thì lấy 12 tháng gần nhất: đủ để thấy xu hướng mà không kéo cả
        // lịch sử của tổ chức chạy nhiều năm.
        Instant effTo = to != null ? to : Instant.now();
        Instant effFrom = from != null ? from : effTo.minus(365, java.time.temporal.ChronoUnit.DAYS);

        Map<String, Map<String, Integer>> byMonth = new LinkedHashMap<>();
        int total = 0;
        for (Object[] r : submissionRepository.submissionCompositionByMonth(scope.unitIds(), effFrom, effTo)) {
            String month = (String) r[0];
            String status = String.valueOf(r[1]);
            int count = r[2] == null ? 0 : ((Number) r[2]).intValue();
            byMonth.computeIfAbsent(month, k -> new LinkedHashMap<>()).merge(status, count, Integer::sum);
            total += count;
        }

        List<TimePoint> points = new ArrayList<>();
        for (Map.Entry<String, Map<String, Integer>> e : byMonth.entrySet()) {
            Map<String, Integer> values = new LinkedHashMap<>();
            // Điền đủ 0 cho trạng thái vắng mặt: thiếu khoá thì vùng chồng bị đứt đoạn.
            for (String st : SUBMISSION_STATUSES) values.put(st, e.getValue().getOrDefault(st, 0));
            points.add(TimePoint.builder().label(formatMonth(e.getKey())).values(values).build());
        }

        return SubmissionCompositionResponse.builder()
                .statuses(statusMetas()).points(points).totalCount(total).build();
    }

    // ============================================================
    // P4 - Cơ cấu trạng thái theo đơn vị (100%)
    // ============================================================

    @Transactional(readOnly = true)
    public SubmissionShareResponse getSubmissionShare(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.unitIds().isEmpty() || scope.anonymize()) {
            return SubmissionShareResponse.builder().statuses(statusMetas()).units(List.of()).build();
        }

        record Acc(String name, Map<String, Integer> counts) {}
        Map<UUID, Acc> byUnit = new LinkedHashMap<>();
        for (Object[] r : submissionRepository.submissionCompositionByUnit(scope.unitIds())) {
            UUID unitId = (UUID) r[0];
            Acc acc = byUnit.computeIfAbsent(unitId, k -> new Acc((String) r[1], new LinkedHashMap<>()));
            acc.counts().merge(String.valueOf(r[2]), r[3] == null ? 0 : ((Number) r[3]).intValue(), Integer::sum);
        }

        List<UnitShare> units = new ArrayList<>();
        for (Map.Entry<UUID, Acc> e : byUnit.entrySet()) {
            int total = e.getValue().counts().values().stream().mapToInt(Integer::intValue).sum();
            if (total == 0) continue;
            Map<String, Double> percents = new LinkedHashMap<>();
            for (String st : SUBMISSION_STATUSES) {
                percents.put(st, round1(e.getValue().counts().getOrDefault(st, 0) * 100.0 / total));
            }
            units.add(UnitShare.builder()
                    .orgUnitId(e.getKey()).name(e.getValue().name())
                    .percents(percents).total(total).build());
        }

        return SubmissionShareResponse.builder().statuses(statusMetas()).units(units).build();
    }

    // ============================================================
    // P2 - Cấu thành điểm BSC (thác nước)
    // ============================================================

    @Transactional(readOnly = true)
    public BscWaterfallResponse getBscWaterfall(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        String mode = scope.orgId() == null ? null
                : bscAnalyticsService.resolveScoringMode(scope.orgId(), scope.periodIds());

        if (scope.isEmpty()) {
            return BscWaterfallResponse.builder().steps(List.of()).totalScore(0.0).scoringMode(mode).build();
        }

        List<WaterfallStep> steps = new ArrayList<>();
        double total = 0;
        for (Object[] r : perspectiveScoreRepository.aggregateByPerspective(scope.unitIds(), scope.periodIds())) {
            Double sumWeighted = dbl(r[6]);
            int scored = r[9] == null ? 0 : ((Number) r[9]).intValue();
            if (sumWeighted == null || scored == 0) continue;
            // Chia cho số lần chấm để ra phần đóng góp TRUNG BÌNH mỗi đánh giá — cộng thẳng tổng
            // sẽ ra một con số phụ thuộc số nhân sự, không so được giữa các kỳ.
            double contribution = sumWeighted / scored;
            steps.add(WaterfallStep.builder()
                    .name((String) r[2])
                    .color((String) r[3])
                    .value(round1(contribution))
                    .weightPercentage(round1(dbl(r[8])))
                    .rawScore(round1(dbl(r[5])))
                    .kpiCount(r[7] == null ? 0 : ((Number) r[7]).intValue())
                    .isTotal(false)
                    .build());
            total += contribution;
        }

        if (!steps.isEmpty()) {
            steps.add(WaterfallStep.builder()
                    .name("Điểm BSC").value(round1(total)).isTotal(true).build());
        }

        return BscWaterfallResponse.builder()
                .steps(steps).totalScore(round1(total)).scoringMode(mode).build();
    }

    // ============================================================
    // T3 - Lịch sử thay đổi trọng số hạng mục
    // ============================================================

    @Transactional(readOnly = true)
    public WeightHistoryResponse getWeightHistory(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        if (scope.orgId() == null || scope.tier() != StatsTierResolver.Tier.ORG) {
            // Trọng số là quyết định cấp tổ chức; lịch sử đổi nó chỉ có nghĩa với người đặt ra nó.
            return WeightHistoryResponse.builder()
                    .perspectives(List.of()).points(List.of()).changeCount(0).build();
        }

        Map<UUID, PerspectiveMeta> metas = new LinkedHashMap<>();
        Map<String, Double> running = new LinkedHashMap<>();
        List<WeightPoint> points = new ArrayList<>();
        int changes = 0;

        for (Object[] r : weightHistoryRepository.weightTimelineByOrg(scope.orgId())) {
            Instant at = (Instant) r[0];
            UUID pid = (UUID) r[1];
            String pname = (String) r[2];
            metas.putIfAbsent(pid, PerspectiveMeta.builder().id(pid).name(pname).color((String) r[3]).build());

            Double oldW = dbl(r[4]);
            Double newW = dbl(r[5]);
            // Đường bậc thang cần trạng thái ĐẦY ĐỦ tại mỗi mốc, không chỉ hạng mục vừa đổi —
            // nên giữ một bản đồ luỹ kế và chụp lại nguyên trạng sau mỗi lần đổi.
            running.putIfAbsent(pid.toString(), oldW);
            running.put(pid.toString(), newW);

            String who = r[7] != null ? (String) r[7] : "Không rõ";
            String reason = r[6] != null && !((String) r[6]).isBlank() ? (String) r[6] : "Không ghi lý do";
            points.add(WeightPoint.builder()
                    .at(at == null ? null : at.toString())
                    .label(at == null ? "" : DateTimeFormatter.ofPattern("dd/MM/yy").withZone(ZoneOffset.UTC).format(at))
                    .values(new LinkedHashMap<>(running))
                    .changeNote(String.format("%s: %s → %s (%s — %s)",
                            pname, fmt(oldW), fmt(newW), who, reason))
                    .build());
            changes++;
        }

        return WeightHistoryResponse.builder()
                .perspectives(new ArrayList<>(metas.values()))
                .points(points)
                .changeCount(changes)
                .build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    private List<StatusMeta> statusMetas() {
        return SUBMISSION_STATUSES.stream()
                .map(c -> StatusMeta.builder()
                        .code(c).label(STATUS_LABELS.get(c)).color(STATUS_COLORS.get(c)).build())
                .toList();
    }

    /** "2026-03" thành "T3/26" cho gọn trục ngang. */
    private static String formatMonth(String yyyyMM) {
        if (yyyyMM == null || yyyyMM.length() < 7) return String.valueOf(yyyyMM);
        return "T" + Integer.parseInt(yyyyMM.substring(5, 7)) + "/" + yyyyMM.substring(2, 4);
    }

    private static String fmt(Double v) {
        return v == null ? "—" : (Math.round(v * 10.0) / 10.0) + "%";
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
