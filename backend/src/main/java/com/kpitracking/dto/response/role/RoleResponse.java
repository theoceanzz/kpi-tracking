package com.kpitracking.dto.response.role;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RoleResponse {

    private UUID id;
    private String name;
    private Boolean isSystem;
    private Integer level;
    private Integer rank;
    private Instant createdAt;
    private Instant updatedAt;
}
