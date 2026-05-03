package com.kpitracking.dto.request.submission;

import lombok.*;

import java.time.LocalDate;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateSubmissionRequest {
    private Double actualValue;
    private String note;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private Boolean isDraft;
}
