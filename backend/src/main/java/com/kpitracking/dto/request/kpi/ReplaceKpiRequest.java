package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReplaceKpiRequest {

    private String replacementReason;

    private KpiType kpiType;

    @NotBlank(message = "Tên KPI thay thế là bắt buộc")
    @Size(max = 255)
    private String name;

    private String description;

    private Double weight;

    private Double targetValue;

    private Double minimumValue;

    private String unit;

    @NotNull(message = "Tần suất là bắt buộc")
    private KpiFrequency frequency;

    private List<UUID> assignedToIds;

    private Boolean isReverseKpi;

    private Boolean isBonusKpi;

    private Instant deadline;

    private UUID keyResultId;
}
