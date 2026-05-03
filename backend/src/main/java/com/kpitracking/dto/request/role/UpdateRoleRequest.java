package com.kpitracking.dto.request.role;

import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class UpdateRoleRequest {

    @Size(max = 100, message = "Role name must not exceed 100 characters")
    private String name;

    private Integer level;
    private Integer rank;
    private UUID parentRoleId;
}
