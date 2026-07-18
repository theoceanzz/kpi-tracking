package com.kpitracking.dto.request.bsc;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScorecardPerspectiveWeightRequest {
    @NotNull
    private UUID perspectiveId;
    @NotNull
    private Double weightPercentage;
    private Integer displayOrder;
    /** Lý do đổi trọng số (ghi vào lịch sử nếu trọng số thay đổi). */
    private String reason;
}
