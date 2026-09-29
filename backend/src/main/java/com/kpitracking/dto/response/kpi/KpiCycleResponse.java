package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
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
    private com.kpitracking.enums.CycleEvaluationMode evaluationMode;
    private UUID organizationId;
    /** Số đợt đang thuộc kỳ này. */
    private long periodCount;

    /** OPEN | LOCKED. */
    private com.kpitracking.enums.KpiCycleStatus status;
    private Instant lockedAt;
    private String lockedByName;
    private Instant reopenedAt;
    private String reopenedByName;
    private String reopenReason;
}
