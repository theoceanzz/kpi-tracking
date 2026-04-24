package com.kpitracking.dto.response.stats;

import com.kpitracking.dto.response.PageResponse;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MyKpiProgressResponse {

    private long totalAssignedKpi;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private long lateSubmissions;
    private Double averageScore;
    private PageResponse<KpiTaskResponse> tasks;
}
