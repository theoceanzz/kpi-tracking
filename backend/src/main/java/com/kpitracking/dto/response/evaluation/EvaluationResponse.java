package com.kpitracking.dto.response.evaluation;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationResponse {

    private UUID id;
    private UUID userId;
    private String userName;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private UUID evaluatorId;
    private String evaluatorName;
    private Double score;
    private String comment;
    private Instant periodStart;
    private Instant periodEnd;
    private Instant createdAt;
    private Instant updatedAt;
}
