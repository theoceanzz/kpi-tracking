package com.kpitracking.dto.response.bsc;

import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ObjectiveRelationResponse {
    private UUID id;
    private UUID sourceObjectiveId;
    private String sourceObjectiveName;
    private UUID targetObjectiveId;
    private String targetObjectiveName;
    private String label;
}
