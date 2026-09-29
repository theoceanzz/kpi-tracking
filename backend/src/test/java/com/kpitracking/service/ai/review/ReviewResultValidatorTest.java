package com.kpitracking.service.ai.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.kpitracking.service.ai.review.ReviewFixtures.context;
import static com.kpitracking.service.ai.review.ReviewFixtures.criterion;
import static com.kpitracking.service.ai.review.ReviewFixtures.submission;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chốt chặn cuối: số của mô hình không bao giờ tới tay quản lý, nhận định không có căn cứ bị bỏ.
 */
class ReviewResultValidatorTest {

    private final ReviewResultValidator validator = new ReviewResultValidator(new ReviewScoreCalculator());
    private final Instant deadline = Instant.parse("2026-09-30T00:00:00Z");

    private final ReviewContext.Criterion c = criterion(20, 0.5, deadline,
            submission("Tháng này tôi đã hoàn thành 12 task, trong đó có 3 task khó về thanh toán.",
                    Instant.parse("2026-09-10T00:00:00Z")));
    private final ReviewContext ctx = context(c);

    private ReviewResults.CriterionAssessment assessment(String level, List<String> quotes,
                                                         Double ach, Double onTime, Double score) {
        return new ReviewResults.CriterionAssessment("Hoàn thành 12 task",
                new ReviewResults.Quality(level, "Có số liệu cụ thể", quotes),
                ach, onTime, score, List.of("Có số liệu"), List.of("Thiếu minh chứng"), List.of("Đính kèm danh sách task"));
    }

    @Test
    @DisplayName("mô hình tự điền ba con số -> bị ghi đè bằng số mã nguồn")
    void overridesModelNumbers() {
        var r = validator.validate(ctx, c, assessment("TỐT", List.of("đã hoàn thành 12 task"), 99.0, 99.0, 99.0));

        assertThat(r.achievementPercent()).isEqualByComparingTo("50.00");
        assertThat(r.onTimePercent()).isEqualByComparingTo("100.00");
        // 20 × (0,6·50 + 0,3·100 + 0,1·100) / 100 = 14
        assertThat(r.suggestedScore()).isEqualByComparingTo("14.00");
    }

    @Test
    @DisplayName("trích dẫn KHÔNG có trong bài nộp -> bỏ nhận xét, điểm mạnh và mức (không vào điểm)")
    void dropsUngroundedClaims() {
        var r = validator.validate(ctx, c, assessment("TỐT", List.of("vượt 200% chỉ tiêu quý"), null, null, null));

        assertThat(r.qualityComment()).isNull();
        assertThat(r.qualityLevel()).isNull();
        assertThat(r.strengths()).isEmpty();
        assertThat(r.evidenceQuotes()).isEmpty();
        // phần còn thiếu / gợi ý vẫn giữ: chúng nói về thứ KHÔNG có trong bài
        assertThat(r.gaps()).containsExactly("Thiếu minh chứng");
    }

    @Test
    @DisplayName("trích dẫn xê dịch hoa/thường, dấu câu, khoảng trắng -> vẫn nhận là có thật")
    void toleratesSmallQuoteDrift() {
        var r = validator.validate(ctx, c, assessment("KHÁ", List.of("“Đã  hoàn thành 12 TASK.”"), null, null, null));

        assertThat(r.qualityLevel()).isEqualTo("KHÁ");
        assertThat(r.evidenceQuotes()).hasSize(1);
    }

    @Test
    @DisplayName("mức không có trong thang -> bỏ mức")
    void levelMustBeInScale() {
        var r = validator.validate(ctx, c, assessment("XUẤT SẮC", List.of("đã hoàn thành 12 task"), null, null, null));

        assertThat(r.qualityLevel()).isNull();
    }

    @Test
    @DisplayName("điểm luôn nằm trong [0, trọng số]")
    void scoreClamped() {
        var big = criterion(5, 1.5, deadline, submission("đã hoàn thành 12 task", Instant.parse("2026-09-10T00:00:00Z")));
        var r = validator.validate(context(big), big, assessment("TỐT", List.of("đã hoàn thành 12 task"), null, null, null));

        assertThat(r.suggestedScore().doubleValue()).isBetween(0.0, 5.0);
    }

    @Test
    @DisplayName("quá nửa chỉ tiêu không có dữ liệu -> mức tin cậy THAP dù mô hình nói CAO")
    void lowConfidenceWhenMostCriteriaLackData() {
        var empty1 = criterion(10, 0.0, deadline);
        var empty2 = criterion(10, 0.0, deadline);
        var ctx3 = context(c, empty1, empty2);
        var results = List.of(
                validator.validate(ctx3, c, assessment("TỐT", List.of("đã hoàn thành 12 task"), null, null, null)),
                validator.noSubmission(ctx3, empty1),
                validator.noSubmission(ctx3, empty2));

        assertThat(validator.confidence("CAO", ctx3, results)).isEqualTo(ReviewResultValidator.CONFIDENCE_LOW);
        assertThat(validator.confidence("CAO", ctx, List.of(results.get(0)))).isEqualTo(ReviewResultValidator.CONFIDENCE_HIGH);
        assertThat(validator.confidence("lung tung", ctx, List.of(results.get(0)))).isEqualTo(ReviewResultValidator.CONFIDENCE_MEDIUM);
    }
}
