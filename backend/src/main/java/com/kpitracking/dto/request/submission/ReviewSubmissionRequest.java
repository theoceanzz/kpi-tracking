package com.kpitracking.dto.request.submission;

import com.kpitracking.enums.SubmissionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReviewSubmissionRequest {

    @NotNull(message = "Status is required")
    private SubmissionStatus status;

    private String reviewNote;
    private Double managerScore;
}
