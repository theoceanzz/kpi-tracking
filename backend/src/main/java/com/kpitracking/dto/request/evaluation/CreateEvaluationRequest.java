package com.kpitracking.dto.request.evaluation;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateEvaluationRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "KPI Criteria ID is required")
    private UUID kpiCriteriaId;

    @NotNull(message = "Score is required")
    @Min(value = 0, message = "Score must be at least 0")
    @Max(value = 100, message = "Score must not exceed 100")
    private Double score;

    private String comment;

    private java.time.LocalDate periodStart;

    private java.time.LocalDate periodEnd;
}
