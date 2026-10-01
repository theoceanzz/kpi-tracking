package com.kpitracking.ai.review;

import com.kpitracking.entity.Organization;
import com.kpitracking.service.ai.review.ReviewContext;
import com.kpitracking.service.ai.review.ReviewResults;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Trạng thái của MỘT lượt AI đánh giá bài nộp khi đi qua {@link SubmissionReviewWorkflow} — vai trò giống
 * {@code AiTurn} của khung chat: các bước đọc/ghi vào đây thay vì truyền tham số qua từng bước.
 */
@Getter
@Setter
public class ReviewRun {

    private final UUID reviewId;
    private final UUID organizationId;
    private final UUID kpiPeriodId;
    private final UUID userId;
    /** Tổ chức đã được kiểm quyền — mang cờ và trọng số. */
    private final Organization organization;

    private ReviewContext context;

    /** Kết quả từng chỉ tiêu; ghi từ nhiều luồng ở bước song song nên dùng danh sách an toàn luồng. */
    private final List<ReviewResults.CriterionResult> results = new CopyOnWriteArrayList<>();
    /** Chỉ tiêu CÓ bài nộp — phần việc của agent chấm chất lượng. */
    private List<ReviewContext.Criterion> pending = List.of();

    private String summary;
    private String confidence;
    private List<String> missingData = List.of();

    private final AtomicInteger promptTokens = new AtomicInteger();
    private final AtomicInteger completionTokens = new AtomicInteger();

    public ReviewRun(UUID reviewId, UUID kpiPeriodId, UUID userId, Organization organization) {
        this.reviewId = reviewId;
        this.organizationId = organization.getId();
        this.kpiPeriodId = kpiPeriodId;
        this.userId = userId;
        this.organization = organization;
    }

    public void addTokens(Integer prompt, Integer completion) {
        if (prompt != null) promptTokens.addAndGet(prompt);
        if (completion != null) completionTokens.addAndGet(completion);
    }
}
