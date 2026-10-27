package com.kpitracking.dto.response.bsc;

import com.kpitracking.enums.bsc.BscLinkType;
import lombok.*;

import java.util.UUID;

/** Một đơn vị con đang gánh một phần chỉ tiêu cha. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CoverageChildResponse {
    private UUID scorecardPerspectiveId;
    private UUID scorecardId;
    private String scorecardName;
    /** Đơn vị đang gánh phần này. Màn hình phân rã cần id để nạp lại đúng dòng đã giao. */
    private UUID orgUnitId;
    private String orgUnitName;
    private BscLinkType linkType;
    private Double contributionValue;
    private Double contributionPercent;
    private Double targetValue;
    private Double weightPercentage;
    /** Đơn vị nhận chỉ tiêu này qua "giao cả bộ" (X% cả bộ) — thu hồi ở tab Giao cả bộ, không ở đây. */
    private Double wholeSharePercent;
}
