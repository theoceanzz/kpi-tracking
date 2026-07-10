package com.kpitracking.dto.request.submission;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateSubmissionRequest {

    @NotNull(message = "KPI Criteria ID is required")
    private UUID kpiCriteriaId;

    // Required for quantitative KPIs; null for qualitative (validated in service).
    private Double actualValue;

    // For qualitative KPIs: the level the employee self-assesses (manager confirms at review).
    private UUID qualitativeLevelId;

    private String note;

    private java.time.LocalDate periodStart;

    private java.time.LocalDate periodEnd;

    private Boolean isDraft;
}
