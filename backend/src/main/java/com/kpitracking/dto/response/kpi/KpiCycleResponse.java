package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.kpi.KpiFrequency;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCycleResponse {
    private UUID id;
    private String name;
    private KpiFrequency cycleType;
    private Instant startDate;
    private Instant endDate;
    private String description;
    private com.kpitracking.enums.evaluation.CycleEvaluationMode evaluationMode;
    private UUID organizationId;
    /** Số đợt đang thuộc kỳ này. */
    private long periodCount;

    /** OPEN | LOCKED. */
    private com.kpitracking.enums.kpi.KpiCycleStatus status;
    private Instant lockedAt;
    private String lockedByName;
    private Instant reopenedAt;
    private String reopenedByName;
    private String reopenReason;
}
