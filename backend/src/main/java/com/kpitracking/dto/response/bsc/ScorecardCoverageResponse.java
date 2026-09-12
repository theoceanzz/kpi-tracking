package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Báo cáo độ phủ của một bộ tiêu chí: chỉ tiêu nào đã phân rã đủ xuống cấp dưới (FR-015). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardCoverageResponse {
    private UUID scorecardId;
    private String scorecardName;
    /** Số chỉ tiêu chưa phân rã dòng nào. */
    private int notCascadedCount;
    private int underCount;
    private int okCount;
    private int overCount;
    private List<CoverageItemResponse> items;
}
