package com.kpitracking.service.analytics;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.enums.KpiParentRelationType;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Tiện ích dùng chung để tính tiến độ/hiệu suất cho cả KPI thường và KPI ngược (inverse).
 *
 * <p>KPI ngược ("càng thấp càng tốt", vd "Tỉ lệ bug ≤ 50%"):
 * <ul>
 *   <li>Chưa có bài nộp → 0%.</li>
 *   <li>actual (bài nộp mới nhất) > target → 0% (chưa đạt).</li>
 *   <li>actual ≤ target → {@code clamp(2 − actual/target, 0, 1.5) × 100} (nhất quán với cách
 *       chấm điểm trong EvaluationService/KpiSubmissionService).</li>
 * </ul>
 */
public final class KpiMetricsCalculator {

    private KpiMetricsCalculator() {}

    private static Instant subTime(KpiSubmission s) {
        return s.getPeriodStart() != null ? s.getPeriodStart() : s.getCreatedAt();
    }

    private static double actualOf(KpiSubmission s) {
        return s.getActualValue() != null ? s.getActualValue() : 0.0;
    }

    /** Tổng actualValue — dùng cho KPI thường (giá trị cộng dồn). */
    public static double sum(List<KpiSubmission> subs) {
        return subs.stream().mapToDouble(KpiMetricsCalculator::actualOf).sum();
    }

    /** actualValue của bài nộp mới nhất — dùng cho KPI ngược (tỉ lệ không cộng dồn). */
    public static double latest(List<KpiSubmission> subs) {
        return subs.stream()
                .max(Comparator.comparing(KpiMetricsCalculator::subTime))
                .map(KpiMetricsCalculator::actualOf)
                .orElse(0.0);
    }

    /**
     * % tiến độ/hiệu suất cho KPI ngược dựa trên một giá trị actual cụ thể.
     * Trả về 0 nếu target không hợp lệ hoặc actual vượt ngưỡng (chưa đạt); ngược lại
     * {@code clamp(2 − actual/target, 0, 1.5) × 100}.
     */
    public static double reversePercent(double actual, double target) {
        if (target <= 0) return 0.0;
        if (actual > target) return 0.0;
        double ratio = Math.min(2.0 - actual / target, 1.5);
        return Math.max(0.0, ratio) * 100.0;
    }

    /**
     * % tiến độ/hiệu suất cho KPI ngược dựa trên bài nộp mới nhất trong {@code subs}.
     * Trả về 0 nếu chưa có bài nộp, target không hợp lệ, hoặc actual vượt ngưỡng (chưa đạt).
     */
    public static double reversePercent(List<KpiSubmission> subs, double target) {
        if (subs.isEmpty()) return 0.0;
        return reversePercent(latest(subs), target);
    }

    /**
     * % tiến độ/hiệu suất theo hướng KPI cho một giá trị actual:
     * KPI ngược dùng {@link #reversePercent(double, double)}; KPI thường là {@code actual/target*100}.
     */
    public static double percent(double actual, double target, boolean reverse) {
        if (reverse) return reversePercent(actual, target);
        return target > 0 ? (actual / target) * 100.0 : 0.0;
    }

    /**
     * Các KPI con kiểu DECOMPOSITION (còn sống) của một KPI cha.
     * Một KPI là "KPI cha" khi có KPI khác trỏ {@code parentId} về nó; với decomposition,
     * trọng số các con cộng lại bằng trọng số cha.
     */
    public static List<KpiCriteria> decompositionChildren(KpiCriteria kpi) {
        if (kpi.getChildren() == null) return List.of();
        return kpi.getChildren().stream()
                .filter(c -> c.getDeletedAt() == null)
                .filter(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION)
                .collect(Collectors.toList());
    }

    /** {@code true} nếu KPI có ≥1 con decomposition còn sống (KPI cha kiểu chia nhỏ). */
    public static boolean hasDecompositionChildren(KpiCriteria kpi) {
        return !decompositionChildren(kpi).isEmpty();
    }
}
