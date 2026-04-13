package com.kpitracking.dto.response.stats;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MyKpiProgressResponse {

    private long totalAssignedKpi;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private Double averageScore;
}
