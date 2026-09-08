package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.AgreementPoint;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.BehaviorCompletionResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.BscVsSystemScatterResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.PerspectiveBubble;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.PerspectiveBubbleResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.ScatterPoint;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.EvaluationPerspectiveScoreRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.util.PerformanceMatrixResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm biểu đồ TƯƠNG QUAN của tab "Chuyên sâu".
 *
 * <p>Phạm vi dữ liệu do {@link StatsTierResolver} quyết định — được phân giải MỘT LẦN ở đầu mỗi
 * phương thức rồi dùng lại, vì {@code PermissionChecker} bên dưới không cache.
 */
@Service
@RequiredArgsConstructor
public class CorrelationAnalyticsService {

    private final StatsTierResolver tierResolver;
    private final EvaluationRepository evaluationRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrganizationRepository organizationRepository;
    private final EvaluationPerspectiveScoreRepository perspectiveScoreRepository;
    private final BscAnalyticsService bscAnalyticsService;

    /**
     * R1 — Phân tán điểm hành vi × % hoàn thành KPI, mỗi chấm là một người trong một đợt.
     *
     * <p>Ở cấp {@code SELF}, danh tính của người khác bị gỡ NGAY TẠI ĐÂY chứ không để frontend tự
     * ẩn: dữ liệu đã rời server thì coi như đã lộ, và chấm ẩn danh vẫn đủ để nhân viên biết mình
     * đứng đâu so với mặt bằng chung.
     */
    @Transactional(readOnly = true)
    public BehaviorCompletionResponse getBehaviorCompletion(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);

        PerformanceMatrixResolver.Matrix matrix = loadMatrix(scope.orgId());
        String xLabel = matrix != null ? matrix.colHeader() : "% Hoàn thành KPI";
        String yLabel = matrix != null ? matrix.rowHeader() : "Điểm hành vi";
        List<Double> xDividers = matrix != null
                ? PerformanceMatrixResolver.bandUpperBounds(matrix.cols()) : List.of();
        List<Double> yDividers = matrix != null
                ? PerformanceMatrixResolver.bandUpperBounds(matrix.rows()) : List.of();

        if (scope.isEmpty()) {
            return emptyResponse(xLabel, yLabel, xDividers, yDividers, scope.anonymize());
        }

        boolean anonymize = scope.anonymize();
        // Nạp số KPI của cả phạm vi bằng MỘT truy vấn gộp rồi tra map trong vòng lặp — hỏi từng
        // người một sẽ thành N+1 ngay trên biểu đồ đông chấm nhất.
        Map<UUID, Integer> kpiCounts = loadKpiCounts(scope);
        List<ScatterPoint> points = new ArrayList<>();
        double maxX = 0.0;
        double maxY = 0.0;

        for (Object[] r : evaluationRepository.behaviorCompletionPoints(scope.unitIds(), scope.periodIds())) {
            UUID userId = (UUID) r[0];
            boolean self = userId != null && userId.equals(scope.userId());
            Double behavior = dbl(r[3]);
            Double completion = dbl(r[4]);
            if (behavior == null || completion == null) continue;

            boolean hideIdentity = anonymize && !self;
            points.add(ScatterPoint.builder()
                    .userId(hideIdentity ? null : userId)
                    .name(hideIdentity ? null : (String) r[1])
                    .orgUnitName(hideIdentity ? null : (String) r[2])
                    .completion(round1(completion))
                    .behavior(round2(behavior))
                    .rating(r[5] == null ? null : ((Number) r[5]).intValue())
                    .isSelf(self)
                    .kpiCount(kpiCounts.getOrDefault(userId, 0))
                    .build());

            maxX = Math.max(maxX, completion);
            maxY = Math.max(maxY, behavior);
        }

        return BehaviorCompletionResponse.builder()
                .xLabel(xLabel)
                .yLabel(yLabel)
                .xMax(axisMax(maxX, xDividers, 100.0))
                .yMax(axisMax(maxY, yDividers, 5.0))
                .xDividers(xDividers)
                .yDividers(yDividers)
                .points(points)
                .totalCount(points.size())
                .anonymized(anonymize)
                .build();
    }

    // ============================================================
    // R2 - Phân tán điểm BSC vs điểm hệ thống
    // ============================================================

    /**
     * Mỗi chấm là một người; đường chéo y=x là nơi hai cách chấm đồng ý.
     *
     * <p>Biểu đồ cột đối chiếu hiện có xếp hai giá trị cạnh nhau nên chỉ đọc được từng người một.
     * Ở đây khoảng cách tới đường chéo chính là mức bất đồng, nên nhóm lệch lộ ra ngay cả khi
     * trung bình hai bên gần như bằng nhau.
     */
    @Transactional(readOnly = true)
    public BscVsSystemScatterResponse getBscVsSystem(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);
        String mode = scope.orgId() == null ? null
                : bscAnalyticsService.resolveScoringMode(scope.orgId(), scope.periodIds());

        // Cấp SELF không được xem mức bất đồng của người khác: đây là dữ liệu đánh giá nội bộ.
        if (scope.isEmpty() || scope.anonymize()) {
            return BscVsSystemScatterResponse.builder()
                    .points(List.of()).axisMax(100.0).scoringMode(mode)
                    .totalCount(0).anonymized(scope.anonymize()).build();
        }

        List<AgreementPoint> points = new ArrayList<>();
        double max = 0;
        for (Object[] r : evaluationRepository.bscOverallByUser(scope.unitIds(), scope.periodIds())) {
            Double bsc = dbl(r[3]);
            Double sys = dbl(r[4]);
            if (bsc == null || sys == null) continue;
            UUID userId = (UUID) r[0];
            points.add(AgreementPoint.builder()
                    .userId(userId)
                    .name((String) r[1])
                    .systemScore(round1(sys))
                    .bscScore(round1(bsc))
                    .gap(round1(bsc - sys))
                    .evaluationCount(r[5] == null ? 0 : ((Number) r[5]).intValue())
                    .isSelf(userId != null && userId.equals(scope.userId()))
                    .build());
            max = Math.max(max, Math.max(bsc, sys));
        }

        return BscVsSystemScatterResponse.builder()
                .points(points)
                .axisMax(max <= 0 ? 100.0 : Math.ceil(max * 1.05))
                .scoringMode(mode)
                .totalCount(points.size())
                .anonymized(false)
                .build();
    }

    // ============================================================
    // R3 - Bong bóng hạng mục BSC
    // ============================================================

    /**
     * Trọng số (X) x điểm đạt (Y) x số KPI (kích thước).
     *
     * <p>Góc phải-dưới là thứ cần tìm: hạng mục được giao trọng số lớn nhưng điểm thấp. Radar cân
     * bằng hiện có cho thấy điểm từng hạng mục nhưng bỏ mất trọng số, nên một hạng mục yếu mà chỉ
     * chiếm 5% trọng số trông nghiêm trọng ngang một hạng mục yếu chiếm 40%.
     */
    @Transactional(readOnly = true)
    public PerspectiveBubbleResponse getPerspectiveBubble(UUID orgUnitId, Collection<UUID> periodIds) {
        StatsTierResolver.TierScope scope = tierResolver.resolve(orgUnitId, periodIds);

        if (scope.isEmpty() || scope.anonymize()) {
            return PerspectiveBubbleResponse.builder().bubbles(List.of()).build();
        }

        List<PerspectiveBubble> bubbles = new ArrayList<>();
        double sumWeight = 0, sumScore = 0;
        int n = 0;
        for (Object[] r : perspectiveScoreRepository.aggregateByPerspective(scope.unitIds(), scope.periodIds())) {
            Double avgRaw = dbl(r[5]);
            Double avgWeight = dbl(r[8]);
            if (avgRaw == null && avgWeight == null) continue;
            double w = avgWeight == null ? 0 : avgWeight;
            double sc = avgRaw == null ? 0 : avgRaw;
            bubbles.add(PerspectiveBubble.builder()
                    .perspectiveId((UUID) r[0])
                    .name((String) r[2])
                    .color((String) r[3])
                    .weightPercentage(round1(w))
                    .averageScore(round1(sc))
                    .kpiCount(r[7] == null ? 0 : ((Number) r[7]).intValue())
                    .build());
            sumWeight += w;
            sumScore += sc;
            n++;
        }

        return PerspectiveBubbleResponse.builder()
                .bubbles(bubbles)
                .avgWeight(n == 0 ? null : round1(sumWeight / n))
                .avgScore(n == 0 ? null : round1(sumScore / n))
                .build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    /** userId → số KPI đã duyệt đang gánh, gộp trong một truy vấn. */
    private Map<UUID, Integer> loadKpiCounts(StatsTierResolver.TierScope scope) {
        Map<UUID, Integer> out = new HashMap<>();
        for (Object[] r : kpiCriteriaRepository.approvedKpiCountByAssignee(scope.unitIds(), scope.periodIds())) {
            if (r[0] == null) continue;
            out.put((UUID) r[0], r[1] == null ? 0 : ((Number) r[1]).intValue());
        }
        return out;
    }

    private PerformanceMatrixResolver.Matrix loadMatrix(UUID orgId) {
        if (orgId == null) return null;
        Organization org = organizationRepository.findById(orgId).orElse(null);
        return org == null ? null : PerformanceMatrixResolver.parse(org.getPerformanceMatrix());
    }

    private static BehaviorCompletionResponse emptyResponse(String xLabel, String yLabel,
                                                            List<Double> xDividers, List<Double> yDividers,
                                                            boolean anonymized) {
        return BehaviorCompletionResponse.builder()
                .xLabel(xLabel).yLabel(yLabel)
                .xMax(100.0).yMax(5.0)
                .xDividers(xDividers).yDividers(yDividers)
                .points(List.of()).totalCount(0).anonymized(anonymized)
                .build();
    }

    /**
     * Trần trục: phải phủ hết cả dữ liệu lẫn vạch chia cuối cùng, nếu không thì vạch bị đẩy ra
     * ngoài khung và người xem mất luôn mốc để so. Nới thêm 5% cho chấm không dính mép.
     */
    private static Double axisMax(double dataMax, List<Double> dividers, double fallback) {
        double max = dataMax;
        for (Double d : dividers) if (d != null) max = Math.max(max, d);
        if (max <= 0) return fallback;
        return Math.ceil(max * 1.05 * 10.0) / 10.0;
    }

    private static Double dbl(Object o) {
        return o == null ? null : ((Number) o).doubleValue();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    private static Double round2(Double v) {
        return v == null ? null : Math.round(v * 100.0) / 100.0;
    }
}
