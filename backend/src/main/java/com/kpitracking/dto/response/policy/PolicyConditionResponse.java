package com.kpitracking.dto.response.policy;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PolicyConditionResponse {

    private UUID id;
    private String type;
    private String conditionJson;
}
