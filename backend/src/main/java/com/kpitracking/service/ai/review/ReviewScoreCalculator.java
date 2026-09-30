package com.kpitracking.service.ai.review;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Ba con số của mỗi chỉ tiêu — do MÃ NGUỒN tính, không bao giờ do mô hình.
 *
 * <ul>
 *   <li><b>% đáp ứng mục tiêu</b>: tỉ lệ đạt của {@code KpiAchievementCalculator} (đã có trần 150%),
 *       nạp sẵn trong {@link ReviewContext.Criterion#achievementRatio()};</li>
 *   <li><b>% đúng hạn</b>: phần bài nộp tạo trước hạn hiệu lực của chỉ tiêu;</li>
 *   <li><b>điểm đề xuất</b> ({@link #points}) trên THANG ĐIỂM ĐÁNH GIÁ — cùng thang với ô quản lý nhập ở màn chấm
 *       (mỗi chỉ tiêu định lượng chiếm {@code trọng số × 100 / Σ trọng số định lượng} điểm). Điểm tối đa của chỉ
 *       tiêu chia theo ba trọng số: {@code tối đa × (wT·min(đạt,1) + wQ·chất lượng + wO·đúng hạn) / 100} — đủ cả
 *       ba là đủ điểm. Chất lượng là thành phần DUY NHẤT phụ thuộc mô hình, và nó chỉ chọn MỨC trong thang của
 *       tổ chức, con số của mức do HR cấu hình.</li>
 * </ul>
 */
@Component
public class ReviewScoreCalculator {

    /** Thang mặc định khi tổ chức chưa cấu hình mức định tính — cùng bộ với dữ liệu mẫu. */
    public static final List<ReviewContext.QualityLevel> DEFAULT_SCALE = List.of(
            new ReviewContext.QualityLevel("KÉM", 0.0, 1),
            new ReviewContext.QualityLevel("YẾU", 20.0, 2),
            new ReviewContext.QualityLevel("TRUNG BÌNH", 50.0, 3),
            new ReviewContext.QualityLevel("KHÁ", 75.0, 4),
            new ReviewContext.QualityLevel("TỐT", 100.0, 5));

    /** Thang dùng cho lượt này: của tổ chức, hoặc mặc định khi trống. */
    public static List<ReviewContext.QualityLevel> scaleOf(ReviewContext ctx) {
        return ctx.scale() == null || ctx.scale().isEmpty() ? DEFAULT_SCALE : ctx.scale();
    }

    /** % đáp ứng (0..150), {@code null} khi chỉ tiêu không đo được bằng số. */
    public BigDecimal achievementPercent(ReviewContext.Criterion c) {
        return c.achievementRatio() == null ? null : round(c.achievementRatio() * 100.0);
    }

    /** % bài nộp tạo trước hạn; {@code null} khi chưa có bài nộp nào. Không có hạn = đúng hạn. */
    public BigDecimal onTimePercent(ReviewContext.Criterion c) {
        if (!c.hasSubmission()) return null;
        if (c.deadline() == null) return round(100.0);
        long onTime = c.submissions().stream()
                .filter(s -> s.submittedAt() == null || !s.submittedAt().isAfter(c.deadline()))
                .count();
        return round(onTime * 100.0 / c.submissions().size());
    }

    /**
     * % chất lượng của mức mô hình chọn: {@code scorePercent} do HR cấu hình; mức chưa cấu hình thì theo
     * vị trí trong thang (thang xếp từ kém tới tốt). Mức không có trong thang -> {@code null}.
     */
    public Double qualityPercent(String levelName, List<ReviewContext.QualityLevel> scale) {
        if (levelName == null || scale == null || scale.isEmpty()) return null;
        for (int i = 0; i < scale.size(); i++) {
            ReviewContext.QualityLevel l = scale.get(i);
            if (l.name().equalsIgnoreCase(levelName.strip())) {
                return l.scorePercent() != null ? l.scorePercent() : (i + 1) * 100.0 / scale.size();
            }
        }
        return null;
    }

    /**
     * Điểm gợi ý của một chỉ tiêu trên THANG ĐIỂM ĐÁNH GIÁ, chia theo ba trọng số (người dùng chốt 30/09: cơ sở là
     * điểm tối đa của chỉ tiêu; đủ cả ba phần = đủ điểm). Vd chỉ tiêu 40 điểm, đạt 80%, chất lượng 75%, đúng hạn:
     * 24×80% + 12×75% + 4×100% = 32,2.
     *
     * @param max    điểm tối đa của chỉ tiêu trên thang đánh giá
     * @param total  tổng gợi ý; phần thiếu (không đo được / chưa có mức) bị bỏ và các trọng số còn lại chia lại cho
     *               đủ — thiếu một phần không đồng nghĩa với 0 điểm phần đó
     * @param system điểm hệ thống của chỉ tiêu trên cùng thang (tỉ lệ đạt × tối đa), để so
     */
    public record Points(BigDecimal max, BigDecimal target, BigDecimal quality, BigDecimal onTime,
                         BigDecimal total, BigDecimal system) {
        /** Chỉ tiêu định tính (chỉ gợi ý MỨC) hoặc không có điểm tối đa. */
        public static final Points NONE = new Points(null, null, null, null, null, null);
    }

    /** 100 / Σ trọng số chỉ tiêu ĐỊNH LƯỢNG — đúng cách màn chấm quy điểm từng chỉ tiêu về thang 100. */
    public static double normFactor(ReviewContext ctx) {
        return normFactor(ctx, false);
    }

    /**
     * Hai thang tách nhau như hệ thống: định lượng → điểm đánh giá 100; định tính → thang HÀNH VI 100 (chia theo trọng
     * số các chỉ tiêu định tính). Người dùng chốt 30/09: định tính cũng chia 60/30/10, trong đó "đạt chỉ tiêu" là mức
     * người nộp tự đánh giá (định tính không có mục tiêu số).
     */
    public static double normFactor(ReviewContext ctx, boolean qualitative) {
        double sum = ctx.criteria().stream().filter(x -> x.qualitative() == qualitative)
                .mapToDouble(ReviewContext.Criterion::weight).sum();
        return sum > 0 ? 100.0 / sum : 0.0;
    }

    /**
     * Định tính: {@code achievementRatio} của chỉ tiêu là % của mức tự đánh giá ({@code KpiAchievementCalculator
     * .qualitativeRatio}), nên phần "đạt chỉ tiêu" và điểm "hệ thống" dùng đúng công thức như định lượng.
     */
    public Points points(ReviewContext ctx, ReviewContext.Criterion c, Double qualityPercent) {
        double max = c.weight() * normFactor(ctx, c.qualitative());
        if (max <= 0) return Points.NONE;
        ReviewContext.Weights w = ctx.weights();
        BigDecimal ach = achievementPercent(c);
        BigDecimal onTime = onTimePercent(c);

        Double target = ach == null ? null : max * w.target() / 100.0 * Math.min(ach.doubleValue(), 100.0) / 100.0;
        Double quality = qualityPercent == null ? null
                : max * w.quality() / 100.0 * Math.min(qualityPercent, 100.0) / 100.0;
        Double onTimePts = onTime == null ? null : max * w.onTime() / 100.0 * onTime.doubleValue() / 100.0;

        double used = (target == null ? 0 : w.target()) + (quality == null ? 0 : w.quality())
                + (onTimePts == null ? 0 : w.onTime());
        Double total = used == 0 ? null
                : Math.max(0.0, Math.min(max, (nz(target) + nz(quality) + nz(onTimePts)) * 100.0 / used));
        Double system = ach == null ? null : max * ach.doubleValue() / 100.0;
        return new Points(round(max), roundOrNull(target), roundOrNull(quality), roundOrNull(onTimePts),
                roundOrNull(total), roundOrNull(system));
    }

    private static double nz(Double v) {
        return v == null ? 0.0 : v;
    }

    private static BigDecimal roundOrNull(Double v) {
        return v == null ? null : round(v);
    }

    static BigDecimal round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
