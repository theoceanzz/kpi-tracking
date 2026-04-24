package com.kpitracking.dto.response.stats;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EmployeeKpiStatsResponse {

    private UUID userId;
    private String fullName;
    private String email;
    private String role;
    private String orgUnitName;
    private long assignedKpi;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private long lateSubmissions;
    private Double averageScore;
}
