package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.BscScorecardLevel;
import com.kpitracking.enums.BscScorecardStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Một node của cây BSC: Công ty → Đơn vị → (đơn vị con). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardTreeNodeResponse {
    private UUID id;
    private String name;
    private BscScorecardLevel level;
    private BscScorecardStatus status;
    private String orgUnitName;
    private String periodLabel;
    private Double totalWeight;
    private int itemCount;
    /** Số chỉ tiêu do cấp trên giao (khoá) — phần còn lại là đơn vị tự thêm. */
    private int assignedCount;
    private int gateCount;
    /** %đạt BSC gần nhất của đơn vị này, nếu đã tính cho đợt đang xem. */
    private Double achievementPercent;
    private List<ScorecardTreeNodeResponse> children;
}
