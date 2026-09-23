package com.kpitracking.service;

import com.kpitracking.dto.response.stats.MatrixAnalyticsResponses.*;
import com.kpitracking.entity.Organization;
import com.kpitracking.repository.EvaluationRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.analytics.AnalyticsScopeResolver;
import com.kpitracking.service.analytics.LatestEvaluationPicker;
import com.kpitracking.util.PerformanceMatrixResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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

        // MỘT truy vấn, rút gọn còn mỗi người một dòng, rồi cả ba con số của khối (thẻ chỉ số,
        // donut, heatmap) đều tính từ CÙNG danh sách đó. Ba truy vấn gộp riêng như trước không
        // lọc trùng người được, nên một người có bao nhiêu đợt thì được đếm bấy nhiêu lần.
        List<Object[]> rows = s.isEmpty()
                ? List.of()
                : LatestEvaluationPicker.keepLatestPerUser(
                        evaluationRepository.matrixRows(s.unitIds(), s.periodIds()),
                        r -> (UUID) r[0],
                        r -> (Instant) r[4]);

        Heatmap heatmap = buildHeatmap(s, rows);
        if (rows.isEmpty()) {
            return OverviewResponse.builder()
                    .personCount(0)
                    .distribution(emptyDistribution())
                    .heatmap(heatmap)
                    .build();
        }

        double sumRating = 0, sumBehavior = 0, sumCompletion = 0;
        int nRating = 0, nBehavior = 0, nCompletion = 0;
        Map<Integer, Integer> distMap = new LinkedHashMap<>();
        for (Object[] r : rows) {
            Double rating = dbl(r[1]);
            if (rating != null) {
                sumRating += rating;
                nRating++;
                distMap.merge((int) Math.round(rating), 1, Integer::sum);
            }
            Double behavior = dbl(r[2]);
            if (behavior != null) { sumBehavior += behavior; nBehavior++; }
            Double completion = dbl(r[3]);
            if (completion != null) { sumCompletion += completion; nCompletion++; }
        }

        return OverviewResponse.builder()
                .averageRating(nRating > 0 ? round2(sumRating / nRating) : null)
                .averageBehavior(nBehavior > 0 ? round2(sumBehavior / nBehavior) : null)
                .averageCompletion(nCompletion > 0 ? round1(sumCompletion / nCompletion) : null)
                .personCount(rows.size())
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

    /**
     * Dựng heatmap: trục từ cấu hình ma trận của org, đếm số NHÂN SỰ mỗi ô. Null nếu org chưa cấu hình.
     *
     * <p>Nhận sẵn danh sách đã rút gọn thay vì tự truy vấn: nếu tự lấy, heatmap sẽ đếm theo lượt
     * đánh giá trong khi donut ngay bên cạnh đếm theo người, và hai tổng trên một khối không khớp.
     */
    private Heatmap buildHeatmap(AnalyticsScopeResolver.Scope s, List<Object[]> rows) {
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

        for (Object[] r : rows) {
            Double behavior = dbl(r[2]);
            Double completion = dbl(r[3]);
            // Truy vấn cũ lọc sẵn hai cột này khác null; giờ lấy chung một danh sách nên phải tự
            // bỏ qua, không thì `cellIndex` nhận null.
            if (behavior == null || completion == null) continue;
            int[] idx = PerformanceMatrixResolver.cellIndex(m, behavior, completion);
            if (idx != null && idx[0] < nRows && idx[1] < nCols) counts[idx[0]][idx[1]]++;
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
