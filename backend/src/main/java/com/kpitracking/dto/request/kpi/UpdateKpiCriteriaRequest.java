package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateKpiCriteriaRequest {

    @Size(max = 255, message = "KPI name must not exceed 255 characters")
    private String name;

    private String description;

    private Double weight;

    private Double targetValue;

    private String unit;

    private KpiFrequency frequency;

    private UUID departmentId;

    private UUID assignedToId;

    private Instant startDate;

    private Instant endDate;
}
