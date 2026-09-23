package com.kpitracking.service.analytics;

import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.BehaviorCompletionResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.ScatterPoint;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrganizationRepository;
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

        // Mỗi người MỘT chấm, lấy đợt gần nhất. Không rút gọn thì một người có bao nhiêu đợt sẽ
        // thành bấy nhiêu chấm chồng lên nhau — đo thật: 216 chấm cho 18 người. Đây cũng là cách
        // xem thay thế của chính khối heatmap, nên hai bên phải cho cùng một tổng.
        List<Object[]> latest = LatestEvaluationPicker.keepLatestPerUser(
                evaluationRepository.behaviorCompletionPoints(scope.unitIds(), scope.periodIds()),
                r -> (UUID) r[0],
                r -> (java.time.Instant) r[6]);
        for (Object[] r : latest) {
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
