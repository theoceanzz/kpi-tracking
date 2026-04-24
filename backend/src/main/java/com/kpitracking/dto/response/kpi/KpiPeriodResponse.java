package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.KpiFrequency;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiPeriodResponse {
    private UUID id;
    private String name;
    private KpiFrequency periodType;
    private Instant startDate;
    private Instant endDate;
    private UUID organizationId;
}
