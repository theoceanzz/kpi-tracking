package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCriteriaResponse {

    private UUID id;
    private String name;
    private String description;
    private Double weight;
    private Double targetValue;
    private String unit;
    private KpiFrequency frequency;
    private KpiStatus status;
    private UUID departmentId;
    private String departmentName;
    private UUID assignedToId;
    private String assignedToName;
    private UUID createdById;
    private String createdByName;
    private UUID approvedById;
    private String approvedByName;
    private String rejectReason;
    private Instant submittedAt;
    private Instant approvedAt;
    private Instant startDate;
    private Instant endDate;
    private Instant createdAt;
    private Instant updatedAt;
}
