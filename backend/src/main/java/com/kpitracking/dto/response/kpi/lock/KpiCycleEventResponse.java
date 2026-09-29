package com.kpitracking.dto.response.kpi.lock;

import com.kpitracking.enums.KpiCycleEventAction;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCycleEventResponse {
    private UUID id;
    private KpiCycleEventAction action;
    private UUID actorId;
    private String actorName;
    private Instant createdAt;
    private UUID periodId;
    private String periodName;
    private UUID newPeriodId;
    private String newPeriodName;
    private UUID targetCycleId;
    private String targetCycleName;
    private Instant oldEndDate;
    private Instant newEndDate;
    private List<UUID> affectedKpiIds;
    private String reason;
    private Map<String, Object> detail;
}
