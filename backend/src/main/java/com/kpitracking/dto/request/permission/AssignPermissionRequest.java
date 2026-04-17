package com.kpitracking.dto.request.permission;

import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AssignPermissionRequest {

    @NotEmpty(message = "Permission IDs must not be empty")
    private List<UUID> permissionIds;
}
