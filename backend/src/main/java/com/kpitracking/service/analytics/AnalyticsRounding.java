package com.kpitracking.service.analytics;

/**
 * Nơi DUY NHẤT thống kê được làm tròn.
 *
 * <p>Quy tắc: <b>không bao giờ làm tròn một số sắp được cộng, chia, so với ngưỡng hay dùng để sắp
 * xếp</b>. Cộng/chia bằng {@code double} cho tới khi dựng DTO, rồi gọi {@link #pct1} / {@link #score1}
 * đúng một lần trong chuỗi {@code .builder()}.
 *
 * <p>Vì sao thành một lớp riêng thay vì gọi {@code Math.round} tại chỗ: trước đây thống kê làm tròn
 * rải rác trong vòng lặp (tròn từng KPI rồi mới lấy trung bình, tròn trước khi so ngưỡng rủi ro),
 * nên cùng một đại lượng ra hai con số khác nhau ở hai màn hình. Lõi tính điểm
 * ({@code KpiAchievementCalculator}, {@code BscCascadeService}) không làm tròn ở đâu cả.
 */
public final class AnalyticsRounding {

    private AnalyticsRounding() {}

    /** Phần trăm hiển thị: một chữ số thập phân. */
    public static double pct1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /** Phần trăm hiển thị, giữ {@code null} (chưa có dữ liệu khác hẳn 0). */
    public static Double pct1(Double v) {
        return v == null ? null : pct1(v.doubleValue());
    }

    /** Điểm đánh giá hiển thị (thang 100 hoặc ma trận 1–5): một chữ số thập phân. */
    public static double score1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /** Điểm đánh giá hiển thị, giữ {@code null}. */
    public static Double score1(Double v) {
        return v == null ? null : score1(v.doubleValue());
    }
}
