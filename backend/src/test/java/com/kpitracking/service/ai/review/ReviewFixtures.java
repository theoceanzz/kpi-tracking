package com.kpitracking.service.ai.review;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Dữ liệu dựng sẵn cho các test của luồng AI đánh giá bài nộp — chỉ record thuần, không entity. */
final class ReviewFixtures {

    private ReviewFixtures() {}

    static final ReviewContext.Weights W = new ReviewContext.Weights(60, 30, 10);

    static ReviewContext.Submission submission(String note, Instant at) {
        return new ReviewContext.Submission(UUID.randomUUID(), note, 12.0, null, "PENDING", at, List.of());
    }

    static ReviewContext.Criterion criterion(double weight, Double ratio, Instant deadline, ReviewContext.Submission... subs) {
        return new ReviewContext.Criterion(UUID.randomUUID(), "Số task hoàn thành", "Hoàn thành task được giao",
                false, "task", 10.0, null, false, weight, deadline, ratio, List.of(subs));
    }

    static ReviewContext context(ReviewContext.Criterion... criteria) {
        return new ReviewContext(UUID.randomUUID(), UUID.randomUUID(), "Tháng 9/2026", UUID.randomUUID(),
                "Nguyễn Văn An", List.of(criteria), ReviewScoreCalculator.DEFAULT_SCALE, List.of(), W);
    }
}
