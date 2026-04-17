package com.kpitracking.dto.response.role;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RoleResponse {

    private UUID id;
    private String name;
    private UUID parentRoleId;
    private String parentRoleName;
    private Boolean isSystem;
    private Instant createdAt;
    private Instant updatedAt;
}
