package com.kpitracking.dto.request.submission;

import lombok.*;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BulkReviewRequest {
    private List<UUID> submissionIds;
    private ReviewSubmissionRequest commonReview;
    private List<IndividualReview> individualReviews;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class IndividualReview {
        private UUID submissionId;
        private Double managerScore;
        private String reviewNote;
    }
}
