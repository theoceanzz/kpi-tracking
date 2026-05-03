package com.kpitracking.dto.request.kpi;

import com.kpitracking.enums.AdjustmentStatus;
import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class BulkReviewAdjustmentRequest {
    private List<UUID> ids;
    private AdjustmentStatus status;
    private String reviewerNote;
}
