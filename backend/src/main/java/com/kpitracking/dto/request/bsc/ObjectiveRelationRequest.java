package com.kpitracking.dto.request.bsc;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObjectiveRelationRequest {
    @NotNull
    private UUID sourceObjectiveId;
    @NotNull
    private UUID targetObjectiveId;
    private String label;
}
