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
 *   <li><b>điểm AI</b> ({@link #points}): chỉ chất lượng bài nộp, trên thang riêng của AI ({@code % mức × tối đa}).
 *       Mô hình chỉ chọn MỨC trong thang của tổ chức, con số của mức do HR cấu hình. Hai số trên chỉ để AI và
 *       quản lý tham khảo, không vào điểm AI.</li>
 * </ul>
 */
@Component
public class ReviewScoreCalculator {

    /**
     * Thang chất lượng của lượt này — ĐÚNG thang tổ chức đã cấu hình, không có thang mặc định.
     *
     * <p>Trước đây trống thì thay bằng một thang dựng sẵn (KÉM/YẾU/.../TỐT): mô hình chọn một mức
     * trong thang không ai cấu hình, rồi mức đó thành % và thành điểm. Core
     * ({@code KpiAchievementCalculator.qualitativeRatio}) trả {@code null} khi mức chưa có
     * {@code scorePercent} và LOẠI chỉ tiêu khỏi cả tử lẫn mẫu — ở đây cũng vậy: thang trống thì
     * không hỏi mức, phần "chất lượng" rụng và 60/30/10 chia lại cho hai phần còn lại.
     */
    public static List<ReviewContext.QualityLevel> scaleOf(ReviewContext ctx) {
        return ctx.scale() == null ? List.of() : ctx.scale();
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
     * % chất lượng của mức mô hình chọn — CHỈ từ {@code scorePercent} do HR cấu hình.
     *
     * <p>{@code null} khi mức không có trong thang HOẶC mức chưa được cấu hình %; trước đây chỗ
     * thiếu % được suy theo vị trí trong thang, tức là bịa ra một con số rồi tính thành điểm.
     */
    public Double qualityPercent(String levelName, List<ReviewContext.QualityLevel> scale) {
        return qualityPercentOf(levelName, scale);
    }

    public static Double qualityPercentOf(String levelName, List<ReviewContext.QualityLevel> scale) {
        if (levelName == null || scale == null || scale.isEmpty()) return null;
        for (ReviewContext.QualityLevel l : scale) {
            if (l.name().equalsIgnoreCase(levelName.strip())) return l.scorePercent();
        }
        return null;
    }

    /**
     * Điểm AI của một chỉ tiêu: CHỈ chất lượng bài nộp, trên thang riêng của AI (người dùng chốt 13/10: bỏ trọng số
     * đạt / chất lượng / đúng hạn, điểm tối đa do công ty đặt, không chia từ thang 100 của định lượng / định tính).
     * Vd thang 10, mức Khá 75% → 7,5. Không có mức (không câu trích thật, lỗi, chưa nộp) thì không có điểm.
     *
     * @param max   điểm tối đa của thang AI
     * @param total điểm AI; {@code null} khi chưa chấm được chất lượng
     */
    public record Points(BigDecimal max, BigDecimal total) {
        public static final Points NONE = new Points(null, null);
    }

    public Points points(ReviewContext ctx, Double qualityPercent) {
        return points(ctx.aiMaxPoints(), qualityPercent);
    }

    /** Dùng cả lúc chấm lẫn lúc ĐỌC (kết quả cũ chấm theo trọng số hiện đúng thang mới, không phải chấm lại). */
    public static Points points(BigDecimal max, Double qualityPercent) {
        if (max == null || max.signum() <= 0) return Points.NONE;
        Double total = qualityPercent == null ? null
                : max.doubleValue() * Math.max(0.0, Math.min(qualityPercent, 100.0)) / 100.0;
        return new Points(max.setScale(2, RoundingMode.HALF_UP), total == null ? null : round(total));
    }

    static BigDecimal round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
