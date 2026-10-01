package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Cấu hình AI đánh giá riêng của một đơn vị (áp cả cho các đơn vị con không có cấu hình riêng). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewUnitSettingResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private Boolean enabled;
    private Integer weightTarget;
    private Integer weightQuality;
    private Integer weightOnTime;
}
