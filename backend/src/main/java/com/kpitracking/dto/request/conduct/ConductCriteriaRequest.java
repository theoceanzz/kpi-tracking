package com.kpitracking.dto.request.conduct;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/** Một tiêu chí hạnh kiểm khi lưu cấu hình. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaRequest {

    @NotBlank(message = "Tên tiêu chí không được để trống")
    private String name;

    private String description;

    @NotNull(message = "Trọng số không được để trống")
    @DecimalMin(value = "0.0", inclusive = false, message = "Trọng số phải lớn hơn 0")
    private Double weight;
}
