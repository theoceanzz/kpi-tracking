package com.kpitracking.dto.response.stats;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AnalyticsDetailRow {

    private UUID userId;
    private String employeeCode;
    private String fullName;
    private String email;
    private String orgUnitName;
    private String roleName;
    private long assignedKpi;
    private long completedKpi;
    private double completionRate;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private Double avgScore;
    private Instant lastSubmissionDate;
}
