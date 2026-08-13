package com.kpitracking.dto.response.admin;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationAdminResponse {

    private UUID id;
    private String name;
    private String code;
    private String status;
    private Boolean enableAi;
    private Boolean enableOkr;
    private Boolean enableWaterfall;
    private Boolean enableQualitative;
    private Boolean enableBsc;
    private Boolean enableReward;
    private long userCount;
    private Instant createdAt;
    private Instant updatedAt;
}
