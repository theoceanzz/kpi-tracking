package com.kpitracking.dto.response.stats;

import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiTaskResponse {
    private UUID id;
    private String name;
    private String periodName;
    private Instant deadline;
    private String status; // NOT_STARTED, PENDING, OVERDUE, APPROVED
    private Instant startDate;
    private Integer submissionCount;
    private Integer expectedSubmissions;
}
