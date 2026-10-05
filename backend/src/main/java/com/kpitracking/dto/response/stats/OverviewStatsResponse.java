package com.kpitracking.dto.response.stats;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OverviewStatsResponse {

    private long totalUsers;
    private long totalOrgUnits;
    private long totalKpiCriteria;
    private long approvedKpi;
    private long pendingKpi;
    private long pendingKpiForApproval;
    private long rejectedKpi;
    private long draftKpi;
    private long totalSubmissions;
    private long pendingSubmissions;
    /** Bài chờ duyệt chỉ trong (các) đợt hiện tại — số đỏ ở sidebar/tab, xem StatsService.currentPeriodIds. */
    private long pendingSubmissionsCurrentPeriod;
    private long approvedSubmissions;
    private long rejectedSubmissions;
    private long totalEvaluations;
    private java.util.List<EvaluationPeriodCountResponse> evaluationPeriods;
}
