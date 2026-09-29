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
 *   <li><b>điểm đề xuất</b> (0..trọng số): {@code weight × (wT·min(đạt,1) + wQ·chất lượng + wO·đúng hạn) / 100}
 *       — chất lượng là thành phần DUY NHẤT phụ thuộc mô hình, và nó chỉ chọn MỨC trong thang của tổ chức,
 *       con số của mức do HR cấu hình.</li>
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
     * Điểm đề xuất trong [0, trọng số]. Thành phần thiếu (không đo được / chưa có mức) được bỏ và các trọng
     * số còn lại chia lại cho đủ 100 — thiếu một thành phần không đồng nghĩa với 0 điểm thành phần đó.
     * Không có thành phần nào -> {@code null}.
     */
    public BigDecimal suggestedScore(ReviewContext.Criterion c, Double qualityPercent, ReviewContext.Weights w) {
        BigDecimal ach = achievementPercent(c);
        BigDecimal onTime = onTimePercent(c);
        double sum = 0, used = 0;
        if (ach != null) { sum += w.target() * Math.min(ach.doubleValue(), 100.0); used += w.target(); }
        if (qualityPercent != null) { sum += w.quality() * Math.min(qualityPercent, 100.0); used += w.quality(); }
        if (onTime != null) { sum += w.onTime() * onTime.doubleValue(); used += w.onTime(); }
        if (used == 0) return null;
        double fraction = sum / (used * 100.0);
        return round(Math.max(0.0, Math.min(c.weight(), c.weight() * fraction)));
    }

    static BigDecimal round(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
