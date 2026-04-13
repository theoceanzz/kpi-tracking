package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCriteriaSummaryResponse {

    private UUID id;
    private String name;
    private Double weight;
    private Double targetValue;
    private String unit;
    private KpiFrequency frequency;
    private KpiStatus status;
    private String departmentName;
    private String assignedToName;
}
