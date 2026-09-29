package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cấu hình AI đánh giá bài nộp của tổ chức. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewSettingsResponse {
    private Boolean enabled;
    private Integer weightTarget;
    private Integer weightQuality;
    private Integer weightOnTime;
}
