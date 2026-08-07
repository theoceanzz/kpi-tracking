package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.CycleUnitEvalAction;
import lombok.*;

import java.time.Instant;

/** Một mốc trong lịch sử chốt / mở khoá đánh giá kỳ của đơn vị. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitEvalEventResponse {
    private CycleUnitEvalAction action;
    private String actorName;
    private String actorRoleName;
    private Double managerScore;
    private String comment;
    private Instant createdAt;
}
