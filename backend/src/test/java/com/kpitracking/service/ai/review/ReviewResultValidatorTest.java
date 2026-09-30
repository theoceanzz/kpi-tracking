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
        // Chỉ tiêu duy nhất -> chiếm cả 100 điểm đánh giá: 60×50% + 30×100% + 10×100% = 70
        assertThat(r.suggestedScore()).isEqualByComparingTo("70.00");
        assertThat(r.points().max()).isEqualByComparingTo("100.00");
        assertThat(r.points().target()).isEqualByComparingTo("30.00");
        assertThat(r.points().quality()).isEqualByComparingTo("30.00");
        assertThat(r.points().onTime()).isEqualByComparingTo("10.00");
        assertThat(r.points().system()).isEqualByComparingTo("50.00");
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
    @DisplayName("căn cứ: mã mô hình chọn -> đoạn gốc của bộ tiêu chí; giữ cả khi nhận xét bị bỏ; mã lạ bị bỏ")
    void resolvesBasisFromRefs() {
        ReviewContext withSet = new ReviewContext(ctx.organizationId(), ctx.kpiPeriodId(), ctx.periodName(),
                ctx.userId(), ctx.userName(), ctx.criteria(), ctx.scale(), List.of(), ctx.weights(), List.of(),
                new ReviewContext.CriteriaSet(java.util.UUID.randomUUID(), 1, "Quy chế", List.of(
                        new ReviewContext.CriteriaRow("Task hoàn thành", "≥ 10 task", 20.0, null, null, "TIEU_CHI",
                                "Điều 4. Mỗi tháng hoàn thành tối thiểu 10 task.", true, null))),
                List.of());
        ReviewResults.CriterionAssessment a = new ReviewResults.CriterionAssessment("Hoàn thành 12 task",
                new ReviewResults.Quality("TỐT", "Có số liệu", List.of("vượt 200% chỉ tiêu quý")),
                null, null, null, List.of(), List.of("Thiếu minh chứng"), List.of(), List.of("TC1", "TC7"));

        var r = validator.validate(withSet, c, a);

        assertThat(r.qualityLevel()).isNull();   // trích dẫn bịa -> bỏ mức
        assertThat(r.basis()).singleElement().satisfies(b -> {
            assertThat(b.ref()).isEqualTo("TC1");
            assertThat(b.excerpt()).isEqualTo("Điều 4. Mỗi tháng hoàn thành tối thiểu 10 task.");
        });
    }

    @Test
    @DisplayName("tự soi: điểm mạnh chỉ giữ khi có câu trích thật trong bài; thiếu / gợi ý giữ nguyên")
    void selfCheckKeepsOnlyGroundedStrengths() {
        var grounded = validator.validateSelfCheck(ctx, c, new ReviewResults.SelfCheckAssessment("Bài nêu số task",
                List.of("Có số liệu cụ thể"), List.of("đã hoàn thành 12 task"), List.of("Thiếu danh sách task"),
                List.of("Đính kèm bảng task"), List.of()));
        assertThat(grounded.strengths()).containsExactly("Có số liệu cụ thể");
        assertThat(grounded.evidenceQuotes()).containsExactly("đã hoàn thành 12 task");

        var invented = validator.validateSelfCheck(ctx, c, new ReviewResults.SelfCheckAssessment("Bài tốt",
                List.of("Vượt chỉ tiêu"), List.of("vượt 200% chỉ tiêu quý"), List.of("Thiếu danh sách task"),
                List.of("Đính kèm bảng task"), List.of("TC1")));
        assertThat(invented.strengths()).isEmpty();
        assertThat(invented.evidenceQuotes()).isEmpty();
        assertThat(invented.gaps()).containsExactly("Thiếu danh sách task");
        assertThat(invented.basis()).isEmpty();   // không có bộ tiêu chí -> không có gì để trích
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
    @DisplayName("điểm luôn nằm trong [0, điểm tối đa của chỉ tiêu trên thang đánh giá]")
    void scoreClamped() {
        var big = criterion(5, 1.5, deadline, submission("đã hoàn thành 12 task", Instant.parse("2026-09-10T00:00:00Z")));
        var r = validator.validate(context(big, criterion(15, 1.0, deadline)), big,
                assessment("TỐT", List.of("đã hoàn thành 12 task"), null, null, null));

        // 5 / (5 + 15) × 100 = 25 điểm tối đa; vượt mục tiêu 150% vẫn không vượt 25.
        assertThat(r.points().max()).isEqualByComparingTo("25.00");
        assertThat(r.suggestedScore().doubleValue()).isBetween(0.0, 25.0);
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
