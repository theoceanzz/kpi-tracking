package com.kpitracking.service.ai.review;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.kpitracking.service.ai.review.ReviewFixtures.context;
import static com.kpitracking.service.ai.review.ReviewFixtures.criterion;
import static com.kpitracking.service.ai.review.ReviewFixtures.submission;
import static org.assertj.core.api.Assertions.assertThat;

/** Ba con số do mã nguồn tính — điểm gợi ý trên thang điểm đánh giá, chia 60/30/10, và các trường hợp thiếu phần. */
class ReviewScoreCalculatorTest {

    private final ReviewScoreCalculator calc = new ReviewScoreCalculator();
    private final Instant deadline = Instant.parse("2026-09-30T00:00:00Z");
    private final Instant before = Instant.parse("2026-09-20T00:00:00Z");
    private final Instant after = Instant.parse("2026-10-02T00:00:00Z");

    /** Một chỉ tiêu định tính chiếm phần trọng số còn lại — không vào thang điểm định lượng (như màn chấm). */
    private static ReviewContext.Criterion qualitative(double weight) {
        return new ReviewContext.Criterion(java.util.UUID.randomUUID(), "Tinh thần phối hợp", null, true, null,
                null, null, false, weight, null, null, List.of());
    }

    @Test
    @DisplayName("ví dụ đã chốt: chỉ tiêu 40 điểm, đạt 80%, Khá 75%, đúng hạn -> 24×80% + 12×75% + 4×100% = 32,2 / 40")
    void agreedExampleOnEvaluationScale() {
        // Ba chỉ tiêu định lượng 20 + 20 + 10 = 50 trọng số -> thang 100: chỉ tiêu 20 trọng số chiếm 40 điểm.
        var c = criterion(20, 0.8, deadline, submission("x", before));
        var ctx = context(c, criterion(20, 1.0, deadline), criterion(10, 1.0, deadline), qualitative(50));

        var p = calc.points(ctx, c, 75.0);

        assertThat(p.max()).isEqualByComparingTo("40.00");
        assertThat(p.target()).isEqualByComparingTo("19.20");
        assertThat(p.quality()).isEqualByComparingTo("9.00");
        assertThat(p.onTime()).isEqualByComparingTo("4.00");
        assertThat(p.total()).isEqualByComparingTo("32.20");
        assertThat(p.system()).isEqualByComparingTo("32.00");   // điểm hệ thống 80% × 40
        assertThat(calc.achievementPercent(c)).isEqualByComparingTo("80.00");
        assertThat(calc.onTimePercent(c)).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("đủ cả ba phần = đủ điểm tối đa; vượt mục tiêu (150%) vẫn chỉ tính 100% cho phần đạt chỉ tiêu")
    void fullMarksEqualMax() {
        var c = criterion(20, 1.5, deadline, submission("x", before));
        var ctx = context(c, criterion(30, 1.0, deadline));   // 20 / 50 -> 40 điểm

        var p = calc.points(ctx, c, 100.0);

        assertThat(p.total()).isEqualByComparingTo("40.00");
        assertThat(p.target()).isEqualByComparingTo("24.00");
        assertThat(calc.achievementPercent(c)).isEqualByComparingTo("150.00");
    }

    @Test
    @DisplayName("tổng điểm AI của các chỉ tiêu định lượng không vượt 100 (cùng thang điểm đánh giá)")
    void totalsStayOnHundredScale() {
        var a = criterion(30, 1.2, deadline, submission("x", before));
        var b = criterion(50, 1.0, deadline, submission("y", before));
        var ctx = context(a, b, qualitative(20));

        double sum = calc.points(ctx, a, 100.0).total().doubleValue() + calc.points(ctx, b, 100.0).total().doubleValue();

        assertThat(sum).isEqualTo(100.0);
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
    @DisplayName("chưa có mức chất lượng -> phần chất lượng null, tổng chia lại trên 2 phần còn lại (không coi là 0)")
    void missingQualityRedistributes() {
        var c = criterion(10, 1.0, deadline, submission("x", before));
        var ctx = context(c);   // chỉ một chỉ tiêu -> 100 điểm

        var p = calc.points(ctx, c, null);

        assertThat(p.quality()).isNull();
        assertThat(p.target()).isEqualByComparingTo("60.00");
        assertThat(p.onTime()).isEqualByComparingTo("10.00");
        // (60 + 10) × 100 / 70 = 100 -> đủ điểm
        assertThat(p.total()).isEqualByComparingTo("100.00");
    }

    @Test
    @DisplayName("định tính: chia 60/30/10 trên THANG HÀNH VI riêng — tự đánh giá Tốt, AI chọn Khá, đúng hạn = 92,5 / 100")
    void qualitativeOnBehaviorScale() {
        // Định lượng 60 + định tính 40: hai thang tách nhau, chỉ tiêu định tính duy nhất chiếm cả 100 điểm hành vi.
        var q = new ReviewContext.Criterion(java.util.UUID.randomUUID(), "Tinh thần phối hợp", null, true, null,
                null, null, false, 40, deadline, 1.0, List.of(submission("hỗ trợ đồng đội", before)));
        var ctx = context(criterion(60, 1.0, deadline), q);

        var p = calc.points(ctx, q, 75.0);

        assertThat(p.max()).isEqualByComparingTo("100.00");
        assertThat(p.target()).isEqualByComparingTo("60.00");     // tự đánh giá Tốt (100%)
        assertThat(p.quality()).isEqualByComparingTo("22.50");    // AI chọn Khá (75%)
        assertThat(p.onTime()).isEqualByComparingTo("10.00");
        assertThat(p.total()).isEqualByComparingTo("92.50");
        assertThat(p.system()).isEqualByComparingTo("100.00");    // theo mức tự đánh giá
    }

    @Test
    @DisplayName("hai thang tách nhau: định lượng chia theo trọng số định lượng, định tính chia theo trọng số định tính")
    void separateScalesPerType() {
        var a = criterion(30, 1.0, deadline);
        var q1 = qualitative(10);
        var q2 = qualitative(30);
        var ctx = context(a, criterion(30, 1.0, deadline), q1, q2);

        assertThat(ReviewScoreCalculator.normFactor(ctx, false)).isEqualTo(100.0 / 60);
        assertThat(ReviewScoreCalculator.normFactor(ctx, true)).isEqualTo(100.0 / 40);
        assertThat(calc.points(ctx, a, 100.0).max()).isEqualByComparingTo("50.00");
        assertThat(calc.points(ctx, q2, 100.0).max()).isEqualByComparingTo("75.00");
    }

    @Test
    @DisplayName("định tính chưa chọn mức tự đánh giá -> phần 'đạt' null, tổng chia lại trên chất lượng + đúng hạn")
    void qualitativeWithoutSelfLevel() {
        var q = new ReviewContext.Criterion(java.util.UUID.randomUUID(), "Tinh thần phối hợp", null, true, null,
                null, null, false, 40, deadline, null, List.of(submission("x", before)));
        var p = calc.points(context(q), q, 75.0);

        assertThat(p.target()).isNull();
        // (22,5 + 10) × 100 / 40 = 81,25
        assertThat(p.total()).isEqualByComparingTo("81.25");
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
