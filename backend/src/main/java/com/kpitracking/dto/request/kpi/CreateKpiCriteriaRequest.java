package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CreateKpiCriteriaRequest {

    @NotBlank(message = "KPI name is required")
    @Size(max = 255, message = "KPI name must not exceed 255 characters")
    private String name;

    private String description;

    private Double weight;

    private Double targetValue;

    private String unit;

    @NotNull(message = "Frequency is required")
    private KpiFrequency frequency;

    private UUID orgUnitId;

    private UUID assignedToId;

    private java.util.List<UUID> assignedToIds;

    @NotNull(message = "KPI Period is required")
    private UUID kpiPeriodId;

    private Double minimumValue;
    private UUID keyResultId;
    private UUID parentId;
}
