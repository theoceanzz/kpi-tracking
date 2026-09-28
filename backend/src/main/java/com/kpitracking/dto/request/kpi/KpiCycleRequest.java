package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCycleRequest {

    @NotBlank(message = "{validation.cycleNameCannotEmpty}")
    private String name;

    @NotNull(message = "{validation.cycleTypeCannotEmpty}")
    private KpiFrequency cycleType;

    @NotNull(message = "{validation.startDateCannotEmpty}")
    private Instant startDate;

    @NotNull(message = "{validation.endDateCannotEmpty}")
    private Instant endDate;

    private String description;

    private com.kpitracking.enums.CycleEvaluationMode evaluationMode;

    private UUID organizationId;

    private java.util.List<UUID> periodIds;
}
