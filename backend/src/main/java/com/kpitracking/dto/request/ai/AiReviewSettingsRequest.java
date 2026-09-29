package com.kpitracking.dto.request.ai;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Cờ bật/tắt và trọng số (%) điểm đề xuất của tính năng AI đánh giá bài nộp. Tổng ba trọng số = 100. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewSettingsRequest {
    @NotNull
    private Boolean enabled;
    @NotNull @Min(0) @Max(100)
    private Integer weightTarget;
    @NotNull @Min(0) @Max(100)
    private Integer weightQuality;
    @NotNull @Min(0) @Max(100)
    private Integer weightOnTime;
}
