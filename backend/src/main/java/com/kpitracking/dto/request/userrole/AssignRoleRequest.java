package com.kpitracking.dto.request.userrole;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AssignRoleRequest {

    @NotNull(message = "User ID is required")
    private UUID userId;

    @NotNull(message = "Role ID is required")
    private UUID roleId;

    @NotNull(message = "Org Unit ID is required")
    private UUID orgUnitId;

    private Instant expiresAt;
}
