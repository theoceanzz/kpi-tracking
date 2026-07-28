package com.kpitracking.service;

import com.kpitracking.dto.response.stats.MatrixAnalyticsResponses.*;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import com.kpitracking.util.PerformanceMatrixResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thống kê Ma trận xếp loại hiệu quả — tab "Ma trận đánh giá" ở trang Thống kê.
 *
 * <p>Gộp {@code matrix_rating / behavior_score / kpi_completion_percent} ĐÃ LƯU trên evaluations
 * (không tính lại). Heatmap dùng cấu hình {@code Organization.performance_matrix} + logic dải
 * chung {@link PerformanceMatrixResolver} với lúc chấm điểm.
 */
@Service
@RequiredArgsConstructor
public class MatrixAnalyticsService {

    private final AnalyticsScopeResolver scopeResolver;
    private final EvaluationRepository evaluationRepository;
    private final OrganizationRepository organizationRepository;

    // ============================================================
    // 1) Overview: thẻ chỉ số + phân bố xếp loại + heatmap
    // ============================================================

    @Transactional(readOnly = true)
    public OverviewResponse getOverview(UUID orgUnitId, Collection<UUID> periodIds) {
        var s = scopeResolver.resolve(orgUnitId, periodIds);
        Heatmap heatmap = buildHeatmap(s);
        if (s.isEmpty()) {
            return OverviewResponse.builder()
                    .evaluationCount(0)
                    .distribution(emptyDistribution())
                    .heatmap(heatmap)
                    .build();
        }

        Object[] overall = firstRow(evaluationRepository.matrixOverall(s.unitIds(), s.periodIds()));
        Double avgRating = overall != null ? dbl(overall[0]) : null;
        Double avgBehavior = overall != null ? dbl(overall[1]) : null;
        Double avgCompletion = overall != null ? dbl(overall[2]) : null;
        int count = overall != null && overall[3] != null ? ((Number) overall[3]).intValue() : 0;

        Map<Integer, Integer> distMap = new LinkedHashMap<>();
        for (Object[] r : evaluationRepository.matrixDistribution(s.unitIds(), s.periodIds())) {
            if (r[0] == null) continue;
            distMap.put(((Number) r[0]).intValue(), r[1] == null ? 0 : ((Number) r[1]).intValue());
        }

        return OverviewResponse.builder()
                .averageRating(round2(avgRating))
                .averageBehavior(round2(avgBehavior))
                .averageCompletion(round1(avgCompletion))
                .evaluationCount(count)
                .distribution(buildDistribution(distMap))
                .heatmap(heatmap)
                .build();
    }

    /** Phân bố xếp loại: đủ 1..5 (thiếu = 0), cộng thêm rating ngoài dải nếu có. */
    private List<RatingBucket> buildDistribution(Map<Integer, Integer> distMap) {
        java.util.TreeSet<Integer> ratings = new java.util.TreeSet<>(distMap.keySet());
        for (int i = 1; i <= 5; i++) ratings.add(i);
        List<RatingBucket> out = new ArrayList<>();
        for (Integer rating : ratings) {
            out.add(RatingBucket.builder().rating(rating).count(distMap.getOrDefault(rating, 0)).build());
        }
        return out;
    }

    private List<RatingBucket> emptyDistribution() {
        List<RatingBucket> out = new ArrayList<>();
        for (int i = 1; i <= 5; i++) out.add(RatingBucket.builder().rating(i).count(0).build());
        return out;
    }

    /** Dựng heatmap: trục từ cấu hình ma trận của org, đếm số nhân sự mỗi ô. Null nếu org chưa cấu hình. */
    private Heatmap buildHeatmap(AnalyticsScopeResolver.Scope s) {
        if (s.orgId() == null) return null;
        Organization org = organizationRepository.findById(s.orgId()).orElse(null);
        if (org == null) return null;
        PerformanceMatrixResolver.Matrix m = PerformanceMatrixResolver.parse(org.getPerformanceMatrix());
        if (m == null) return null;

        int nRows = m.rows().size(), nCols = m.cols().size();
        List<List<Integer>> ratings = new ArrayList<>();
        int[][] counts = new int[nRows][nCols];
        for (int r = 0; r < nRows; r++) {
            List<Integer> row = new ArrayList<>();
            for (int c = 0; c < nCols; c++) {
                int val = (r < m.cells().length && c < m.cells()[r].length) ? m.cells()[r][c] : 0;
                row.add(val);
            }
            ratings.add(row);
        }

        if (!s.isEmpty()) {
            for (Object[] pair : evaluationRepository.matrixPairs(s.unitIds(), s.periodIds())) {
                int[] idx = PerformanceMatrixResolver.cellIndex(m, dbl(pair[0]), dbl(pair[1]));
                if (idx != null && idx[0] < nRows && idx[1] < nCols) counts[idx[0]][idx[1]]++;
            }
        }

        List<List<Integer>> countList = new ArrayList<>();
        for (int r = 0; r < nRows; r++) {
            List<Integer> row = new ArrayList<>();
            for (int c = 0; c < nCols; c++) row.add(counts[r][c]);
            countList.add(row);
        }
        return Heatmap.builder()
                .rowHeader(m.rowHeader()).colHeader(m.colHeader())
                .rows(m.rows()).cols(m.cols())
                .ratings(ratings).counts(countList)
                .build();
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Object[] firstRow(List<Object[]> rows) {
        return rows == null || rows.isEmpty() ? null : rows.get(0);
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
