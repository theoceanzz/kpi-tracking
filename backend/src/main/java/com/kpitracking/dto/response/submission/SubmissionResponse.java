package com.kpitracking.dto.response.submission;

import com.kpitracking.enums.SubmissionStatus;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SubmissionResponse {

    private UUID id;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private Double actualValue;
    private Double targetValue;
    private String note;
    private SubmissionStatus status;
    private UUID submittedById;
    private String submittedByName;
    private UUID reviewedById;
    private String reviewedByName;
    private String reviewNote;
    private Instant reviewedAt;
    private Instant periodStart;
    private Instant periodEnd;
    private List<AttachmentResponse> attachments;
    private Instant createdAt;
    private Instant updatedAt;
}
