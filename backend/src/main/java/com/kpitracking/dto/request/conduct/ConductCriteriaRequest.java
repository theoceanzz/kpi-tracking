package com.kpitracking.dto.request.conduct;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

/** Một tiêu chí hạnh kiểm khi lưu cấu hình. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductCriteriaRequest {

    /** Id tiêu chí đang có trong bộ ⇒ sửa tại chỗ; bỏ trống ⇒ tiêu chí mới. */
    private UUID id;

    @NotBlank(message = "{validation.criterionNameCannotEmpty}")
    private String name;

    private String description;

    @NotNull(message = "{validation.weightCannotEmpty}")
    @DecimalMin(value = "0.0", inclusive = false, message = "{validation.weightMustGreaterThan0}")
    private Double weight;
}
