package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** Cấu hình AI đánh giá bài nộp của tổ chức: cờ bật/tắt + thang điểm AI (xếp theo điểm tăng dần). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewSettingsResponse {
    private Boolean enabled;
    private List<Level> levels;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Level {
        private String name;
        private BigDecimal points;
        private String color;
        private String description;
    }
}
