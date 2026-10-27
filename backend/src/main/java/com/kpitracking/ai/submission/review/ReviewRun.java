package com.kpitracking.ai.submission.review;

import com.kpitracking.entity.organization.Organization;
import com.kpitracking.ai.submission.review.ReviewContext;
import com.kpitracking.ai.submission.review.ReviewResults;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Set;
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
    /**
     * Chỉ tiêu được chấm trong lượt này; rỗng = cả phiếu. Ngữ cảnh vẫn dựng ĐỦ chỉ tiêu vì điểm tối đa của một chỉ
     * tiêu chia trên tổng trọng số của cả phiếu.
     */
    private final Set<UUID> scope;

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
        this(reviewId, kpiPeriodId, userId, organization, Set.of());
    }

    public ReviewRun(UUID reviewId, UUID kpiPeriodId, UUID userId, Organization organization, Set<UUID> scope) {
        this.reviewId = reviewId;
        this.organizationId = organization.getId();
        this.kpiPeriodId = kpiPeriodId;
        this.userId = userId;
        this.organization = organization;
        this.scope = scope == null ? Set.of() : Set.copyOf(scope);
    }

    /** Lượt chỉ chấm vài chỉ tiêu (bấm "Gợi ý" ở một dòng / "Gợi ý tất cả" các dòng còn trống). */
    public boolean scoped() {
        return !scope.isEmpty();
    }

    /** Chỉ tiêu này có được chấm trong lượt không. */
    public boolean inScope(UUID kpiCriteriaId) {
        return scope.isEmpty() || scope.contains(kpiCriteriaId);
    }

    public void addTokens(Integer prompt, Integer completion) {
        if (prompt != null) promptTokens.addAndGet(prompt);
        if (completion != null) completionTokens.addAndGet(completion);
    }
}
