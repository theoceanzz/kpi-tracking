package com.kpitracking.dto.request.conduct;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

/** Một nhóm tiêu chí khi lưu cấu hình: trọng số nhóm trên tổng, tiêu chí mang % TRONG NHÓM. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ConductGroupRequest {

    @NotBlank(message = "{validation.criterionNameCannotEmpty}")
    private String name;

    @NotNull(message = "{validation.weightCannotEmpty}")
    @DecimalMin(value = "0.0", inclusive = false, message = "{validation.weightMustGreaterThan0}")
    private Double weight;

    @Valid
    private List<ConductCriteriaRequest> criteria;
}
