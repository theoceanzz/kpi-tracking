package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/** Đơn vị tắt AI đánh giá bài nộp (áp cả cho các đơn vị con không có cấu hình riêng). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewUnitSettingResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private Boolean enabled;
}
