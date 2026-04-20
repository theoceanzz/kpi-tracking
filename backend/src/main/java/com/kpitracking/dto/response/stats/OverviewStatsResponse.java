package com.kpitracking.dto.response.stats;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OverviewStatsResponse {

    private long totalUsers;
    private long totalOrgUnits;
    private long totalKpiCriteria;
    private long approvedKpi;
    private long pendingKpi;
    private long rejectedKpi;
    private long draftKpi;
    private long totalSubmissions;
    private long pendingSubmissions;
    private long approvedSubmissions;
    private long rejectedSubmissions;
    private long totalEvaluations;
}
