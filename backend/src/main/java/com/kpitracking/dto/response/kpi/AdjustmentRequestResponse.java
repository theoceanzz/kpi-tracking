package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiType;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AdjustmentRequestResponse {
    private UUID id;
    private UUID kpiCriteriaId;
    private String kpiCriteriaName;
    private KpiType kpiType;
    private Double currentTargetValue;
    private Double currentWeight;
    private Double currentMinimumValue;
    private Double requestedTargetValue;
    private Double requestedMinimumValue;
    private boolean deactivationRequest;
    private Double compensationPercentage;
    private String reason;
    private AdjustmentStatus status;
    private UUID requesterId;
    private String requesterName;
    private UUID reviewerId;
    private String reviewerName;
    private String reviewerNote;
    private Instant createdAt;
    private Instant updatedAt;
}
