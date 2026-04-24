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
    private UUID orgUnitId;
    private String orgUnitName;
    private java.util.List<com.kpitracking.dto.response.user.UserResponse> assignees;
    private java.util.List<UUID> assigneeIds;
    private java.util.List<String> assigneeNames;
    private UUID createdById;
    private String createdByName;
    private UUID approvedById;
    private String approvedByName;
    private String rejectReason;
    private Instant submittedAt;
    private Instant approvedAt;
    private Double minimumValue;
    private UUID kpiPeriodId;
    private KpiPeriodResponse kpiPeriod;
    private Integer submissionCount;
    private Integer expectedSubmissions;
    private Instant createdAt;
    private Instant updatedAt;
}
