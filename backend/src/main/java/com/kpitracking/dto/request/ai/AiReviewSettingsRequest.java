package com.kpitracking.dto.request.ai;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** Cờ bật/tắt và THANG ĐIỂM AI (các mức AI chọn khi chấm chất lượng bài nộp). Thứ tự danh sách = thứ tự hiển thị. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewSettingsRequest {
    @NotNull
    private Boolean enabled;
    @NotNull @Valid
    private List<Level> levels;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Level {
        @NotBlank @Size(max = 100)
        private String name;
        @NotNull @DecimalMin("0") @DecimalMax("1000")
        private BigDecimal points;
        @Size(max = 20)
        private String color;
        @Size(max = 500)
        private String description;
    }
}
