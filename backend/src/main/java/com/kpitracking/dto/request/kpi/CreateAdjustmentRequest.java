package com.kpitracking.dto.request.kpi;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateAdjustmentRequest {
    @NotNull(message = "KPI Criteria ID is required")
    private UUID kpiCriteriaId;

    private Double requestedTargetValue;
    private Double requestedWeight;
    private Double requestedMinimumValue;
    private boolean deactivationRequest;

    @NotBlank(message = "Reason is required")
    private String reason;
}
