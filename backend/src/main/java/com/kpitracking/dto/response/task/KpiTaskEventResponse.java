package com.kpitracking.dto.response.task;

import com.kpitracking.enums.KpiTaskEventAction;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskEventResponse {

    private UUID id;
    private KpiTaskEventAction action;
    private String oldValue;
    private String newValue;
    private UUID actorId;
    private String actorName;
    private Instant createdAt;
}
