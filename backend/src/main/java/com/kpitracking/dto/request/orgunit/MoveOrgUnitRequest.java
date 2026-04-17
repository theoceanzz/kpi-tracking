package com.kpitracking.dto.request.orgunit;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class MoveOrgUnitRequest {

    @NotNull(message = "New parent ID is required (use null for root)")
    private UUID newParentId;
}
