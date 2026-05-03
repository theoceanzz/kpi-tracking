package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.AdjustmentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ReviewAdjustmentRequest {
    @NotNull(message = "Status is required")
    private AdjustmentStatus status;
    private String reviewerNote;
}
