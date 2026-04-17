package com.kpitracking.dto.response.userrole;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UserRoleOrgUnitResponse {

    private UUID userId;
    private String userFullName;
    private String userEmail;
    private UUID roleId;
    private String roleName;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID assignedById;
    private String assignedByName;
    private Instant assignedAt;
    private Instant expiresAt;
}
