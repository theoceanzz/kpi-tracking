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
    private long pendingTaskCount;
    /** Như pendingTaskCount / rejectedSubmissions nhưng chỉ trong (các) đợt hiện tại — dùng cho số đỏ. */
    private long currentPendingTaskCount;
    private long currentRejectedSubmissions;
    private Double averageScore;
    private PageResponse<KpiTaskResponse> tasks;
}
