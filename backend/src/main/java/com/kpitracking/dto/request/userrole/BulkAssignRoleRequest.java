package com.kpitracking.dto.request.userrole;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BulkAssignRoleRequest {

    @NotEmpty(message = "At least one User ID is required")
    private List<UUID> userIds;

    @NotNull(message = "Role ID is required")
    private UUID roleId;

    @NotNull(message = "Org Unit ID is required")
    private UUID orgUnitId;

    private Instant expiresAt;
}
