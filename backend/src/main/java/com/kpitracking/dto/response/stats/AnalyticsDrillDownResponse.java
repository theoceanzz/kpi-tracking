package com.kpitracking.dto.response.stats;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AnalyticsDrillDownResponse {

    private UUID orgUnitId;
    private String orgUnitName;
    private String levelName;

    private long totalKpi;
    private long approvedKpi;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private Double avgScore;
    private long memberCount;

    private List<OrgUnitSummary> childUnits;
    private List<EmployeeSummary> employees;
    private List<HeatmapPoint> heatmapData;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OrgUnitSummary {
        private UUID orgUnitId;
        private String orgUnitName;
        private String levelName;
        private long memberCount;
        private long totalKpi;
        private long approvedKpi;
        private double completionRate;
        private long totalSubmissions;
        private long approvedSubmissions;
        private long pendingSubmissions;
        private long rejectedSubmissions;
        private Double avgScore;
        private boolean hasChildren;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HeatmapPoint {
        private String x; // Sub-unit name
        private String y; // KPI name
        private double value; // Performance/Completion
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EmployeeSummary {
        private UUID userId;
        private String fullName;
        private String email;
        private String roleName;
        private long assignedKpi;
        private long totalSubmissions;
        private long approvedSubmissions;
        private long pendingSubmissions;
        private long rejectedSubmissions;
        private Double avgScore;
    }
}
