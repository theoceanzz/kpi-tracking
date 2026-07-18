package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscScoringMode;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BscDashboardResponse {
    private UUID scorecardId;
    private String name;
    private String vision;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private BscScoringMode scoringMode;
    /** Điểm BSC tổng hợp toàn tổ chức cho thẻ điểm này (0..100+). */
    private Double overallScore;
    private List<PerspectiveScoreResponse> perspectives;
}
