package com.kpitracking.service.analytics;

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.submission.KpiSubmission;
import com.kpitracking.enums.kpi.KpiParentRelationType;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Tiện ích về HÌNH DẠNG dữ liệu KPI cho thống kê: cộng giá trị bài nộp, duyệt cây KPI con, ghép
 * tên người đảm nhiệm.
 *
 * <p><b>Ở đây không còn công thức tính % nào.</b> Mọi tỉ lệ đạt đi qua
 * {@link AnalyticsKpiMetrics} → {@code KpiAchievementCalculator} của lõi. Trước 10/2026 lớp này
 * có {@code percent}/{@code reversePercent}/{@code latest} — một bộ công thức song song với lõi,
 * và chúng lệch nhau: KPI ngược vượt chỉ tiêu bị trả 0 (lõi cho {@code 2 − actual/target}), KPI
 * ngược chỉ lấy bài nộp mới nhất (lõi cộng), và sàn {@code minimumValue} / {@code compensated
 * AchievementPercent} / KPI thưởng không được xét. Đã xoá để không ai vô tình dùng lại.
 */
public final class KpiMetricsCalculator {

    private KpiMetricsCalculator() {}

    private static double actualOf(KpiSubmission s) {
        return s.getActualValue() != null ? s.getActualValue() : 0.0;
    }

    /** Tổng actualValue của một tập bài nộp. Lọc tập nào là việc của người gọi. */
    public static double sum(List<KpiSubmission> subs) {
        return subs.stream().mapToDouble(KpiMetricsCalculator::actualOf).sum();
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

    /** Tên người đảm nhiệm KPI (ghép bằng ", " nếu nhiều người); null nếu chưa giao. */
    public static String assigneeNames(KpiCriteria kpi) {
        if (kpi.getAssignees() == null || kpi.getAssignees().isEmpty()) return null;
        String names = kpi.getAssignees().stream()
                .map(u -> u.getFullName())
                .filter(n -> n != null && !n.isBlank())
                .collect(Collectors.joining(", "));
        return names.isBlank() ? null : names;
    }

    /** Tất cả KPI con còn sống (mọi loại quan hệ) của một KPI. */
    public static List<KpiCriteria> children(KpiCriteria kpi) {
        if (kpi.getChildren() == null) return List.of();
        return kpi.getChildren().stream()
                .filter(c -> c.getDeletedAt() == null)
                .collect(Collectors.toList());
    }

    /**
     * Loại quan hệ của các con: {@code DECOMPOSITION} nếu có con decomposition ("KPI cha"),
     * ngược lại {@code DELEGATION} nếu có con delegation ("KPI thác nước"), hoặc {@code null}
     * nếu không có con.
     */
    public static KpiParentRelationType childRelationType(KpiCriteria kpi) {
        List<KpiCriteria> kids = children(kpi);
        if (kids.isEmpty()) return null;
        boolean hasDecomp = kids.stream().anyMatch(c -> c.getParentRelationType() == KpiParentRelationType.DECOMPOSITION);
        if (hasDecomp) return KpiParentRelationType.DECOMPOSITION;
        boolean hasDeleg = kids.stream().anyMatch(c -> c.getParentRelationType() == KpiParentRelationType.DELEGATION);
        return hasDeleg ? KpiParentRelationType.DELEGATION : null;
    }
}
