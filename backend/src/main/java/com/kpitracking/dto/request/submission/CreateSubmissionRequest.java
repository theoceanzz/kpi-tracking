package com.kpitracking.dto.request.submission;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateSubmissionRequest {

    @NotNull(message = "KPI Criteria ID is required")
    private UUID kpiCriteriaId;

    @NotNull(message = "Actual value is required")
    private Double actualValue;

    private String note;

    private java.time.LocalDate periodStart;

    private java.time.LocalDate periodEnd;
}
