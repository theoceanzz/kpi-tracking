package com.kpitracking.dto.response.feedback360;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một báo cáo 360 đã công bố của chính người dùng. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360MyReportResponse {
    private UUID subjectId;
    private UUID campaignId;
    private String campaignName;
    private Instant releasedAt;
    private Double overallScore;
    private Double selfScore;
    private Integer scaleMax;
    private Integer responseCount;
}
