package com.kpitracking.dto.request.policy;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AddPolicyConditionRequest {

    @NotBlank(message = "Condition type is required (ATTRIBUTE, TIME, or ORG_UNIT)")
    private String type;

    @NotNull(message = "Condition JSON is required")
    private Object conditionJson;
}
