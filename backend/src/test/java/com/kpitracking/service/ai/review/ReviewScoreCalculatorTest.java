package com.kpitracking.service.ai.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.kpitracking.service.ai.review.ReviewFixtures.W;
import static com.kpitracking.service.ai.review.ReviewFixtures.criterion;
import static com.kpitracking.service.ai.review.ReviewFixtures.submission;
import static org.assertj.core.api.Assertions.assertThat;

/** Ba con số do mã nguồn tính — công thức 60/30/10 và các trường hợp thiếu thành phần. */
class ReviewScoreCalculatorTest {

    private final ReviewScoreCalculator calc = new ReviewScoreCalculator();
    private final Instant deadline = Instant.parse("2026-09-30T00:00:00Z");
    private final Instant before = Instant.parse("2026-09-20T00:00:00Z");
    private final Instant after = Instant.parse("2026-10-02T00:00:00Z");

    @Test
    @DisplayName("đạt 80%, chất lượng 75%, đúng hạn 100%, trọng số 20 -> 20 × (0,6·80 + 0,3·75 + 0,1·100)/100 = 16,1")
    void fullFormula() {
        var c = criterion(20, 0.8, deadline, submission("x", before));

        assertThat(calc.achievementPercent(c)).isEqualByComparingTo("80.00");
        assertThat(calc.onTimePercent(c)).isEqualByComparingTo("100.00");
        assertThat(calc.suggestedScore(c, 75.0, W)).isEqualByComparingTo("16.10");
    }

    @Test
    @DisplayName("vượt mục tiêu (150%) -> phần mục tiêu tính tối đa 100%, điểm không vượt trọng số")
    void overAchievementCapped() {
        var c = criterion(20, 1.5, deadline, submission("x", before));

        assertThat(calc.achievementPercent(c)).isEqualByComparingTo("150.00");
        assertThat(calc.suggestedScore(c, 100.0, W)).isEqualByComparingTo("20.00");
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
    @DisplayName("chưa có mức chất lượng -> trọng số còn lại chia lại cho đủ 100 (không coi là 0 điểm chất lượng)")
    void missingQualityRedistributes() {
        var c = criterion(10, 1.0, deadline, submission("x", before));

        // (60·100 + 10·100) / (70·100) = 1 -> đủ trọng số
        assertThat(calc.suggestedScore(c, null, W)).isEqualByComparingTo("10.00");
    }

    @Test
    @DisplayName("% chất lượng: lấy score_percent của mức; mức chưa cấu hình -> theo vị trí; mức lạ -> null")
    void qualityPercent() {
        var scale = List.of(
                new ReviewContext.QualityLevel("KÉM", null, 1),
                new ReviewContext.QualityLevel("KHÁ", 75.0, 2),
                new ReviewContext.QualityLevel("TỐT", null, 3));

        assertThat(calc.qualityPercent("khá", scale)).isEqualTo(75.0);
        assertThat(calc.qualityPercent("TỐT", scale)).isEqualTo(100.0);
        assertThat(calc.qualityPercent("XUẤT SẮC", scale)).isNull();
    }
}
