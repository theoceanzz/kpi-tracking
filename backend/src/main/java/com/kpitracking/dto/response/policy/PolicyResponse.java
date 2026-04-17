package com.kpitracking.dto.response.policy;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PolicyResponse {

    private UUID id;
    private UUID orgUnitId;
    private String orgUnitName;
    private String name;
    private String effect;
    private List<PolicyConditionResponse> conditions;
    private Instant createdAt;
    private Instant updatedAt;
}
