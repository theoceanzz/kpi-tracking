package com.kpitracking.ai.submission.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.kpitracking.ai.submission.review.ReviewFixtures.context;
import static com.kpitracking.ai.submission.review.ReviewFixtures.criterion;
import static com.kpitracking.ai.submission.review.ReviewFixtures.submission;
import static org.assertj.core.api.Assertions.assertThat;

/** Số do mã nguồn tính: điểm AI = % chất lượng × điểm tối đa của thang AI; % đạt và % đúng hạn để tham khảo. */
class ReviewScoreCalculatorTest {

    private final ReviewScoreCalculator calc = new ReviewScoreCalculator();
    private final Instant deadline = Instant.parse("2026-09-30T00:00:00Z");
    private final Instant before = Instant.parse("2026-09-20T00:00:00Z");
    private final Instant after = Instant.parse("2026-10-02T00:00:00Z");

    @Test
    @DisplayName("điểm AI chỉ theo chất lượng, thang riêng: Khá 75% trên thang 10 -> 7,5 / 10, không phụ thuộc trọng số chỉ tiêu")
    void qualityOnlyOnOwnScale() {
        var c = criterion(20, 0.8, deadline, submission("x", after));   // đạt 80%, nộp trễ: không còn ảnh hưởng điểm AI
        var ctx = context(c, criterion(30, 1.0, deadline));

        var p = calc.points(ctx, 75.0);

        assertThat(p.max()).isEqualByComparingTo("10.00");
        assertThat(p.total()).isEqualByComparingTo("7.50");
        assertThat(calc.achievementPercent(c)).isEqualByComparingTo("80.00");
        assertThat(calc.onTimePercent(c)).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("chưa có mức chất lượng -> không có điểm; % trên 100 bị kẹp; thang 0 -> không chấm")
    void edges() {
        assertThat(ReviewScoreCalculator.points(java.math.BigDecimal.TEN, null).total()).isNull();
        assertThat(ReviewScoreCalculator.points(java.math.BigDecimal.TEN, 120.0).total()).isEqualByComparingTo("10.00");
        assertThat(ReviewScoreCalculator.points(java.math.BigDecimal.valueOf(100), 50.0).total()).isEqualByComparingTo("50.00");
        assertThat(ReviewScoreCalculator.points(java.math.BigDecimal.ZERO, 75.0)).isEqualTo(ReviewScoreCalculator.Points.NONE);
    }

    @Test
    @DisplayName("một bài trễ trong hai -> đúng hạn 50%; không có hạn -> 100%; chưa nộp -> null")
    void onTime() {
        assertThat(calc.onTimePercent(criterion(10, 1.0, deadline, submission("a", before), submission("b", after))))
                .isEqualByComparingTo("50.00");
        assertThat(calc.onTimePercent(criterion(10, 1.0, null, submission("a", after)))).isEqualByComparingTo("100.00");
        assertThat(calc.onTimePercent(criterion(10, 0.0, deadline))).isNull();
    }

    @Test
    @DisplayName("% chất lượng: lấy score_percent của mức; mức chưa cấu hình % -> null (loại khỏi điểm, như core); mức lạ -> null")
    void qualityPercent() {
        var scale = List.of(
                new ReviewContext.QualityLevel("KÉM", null, 1),
                new ReviewContext.QualityLevel("KHÁ", 75.0, 2),
                new ReviewContext.QualityLevel("TỐT", null, 3));

        assertThat(calc.qualityPercent("khá", scale)).isEqualTo(75.0);
        // Trước đây suy theo vị trí trong thang (3/3 -> 100%). Đó là bịa ra một con số rồi tính
        // thành điểm; KpiAchievementCalculator.qualitativeRatio trả null và loại chỉ tiêu.
        assertThat(calc.qualityPercent("TỐT", scale)).isNull();
        assertThat(calc.qualityPercent("XUẤT SẮC", scale)).isNull();
    }
}
