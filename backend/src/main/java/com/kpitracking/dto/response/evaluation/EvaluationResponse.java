package com.kpitracking.dto.response.evaluation;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationResponse {

    private UUID id;
    private UUID userId;
    private String userName;
    private UUID orgUnitId;
    private String orgUnitName;
    private UUID kpiPeriodId;
    private String kpiPeriodName;
    private UUID evaluatorId;
    private String evaluatorName;
    private Double score;
    private String comment;
    private Double systemScore;
    private Instant createdAt;
    private Instant updatedAt;
    private String evaluatorRole;
    private Integer evaluatorRoleLevel;
    private Integer orgUnitLevel;
    private Integer userLevel;
    private Integer userRank;
    private String userRoleName;
    private String evaluatorRoleName;
}
