package com.kpitracking.dto.response.organization;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class OrganizationResponse {

    private UUID id;
    private String name;
    private String code;
    private String status;
    private List<HierarchyLevelResponse> hierarchyLevels;
    private Double evaluationMaxScore;
    private java.util.List<EvaluationLevelResponse> evaluationLevels;
    private Integer kpiReminderPercentage;
    private Instant createdAt;
    private Instant updatedAt;
}
