package com.kpitracking.dto.response.stats;

import lombok.*;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiDetailRow {
    private String kpiName;
    private Double weight;
    private String unit;
    private Double targetValue;
    private Double actualValue;
    private Double completionRate;
    private Double managerScore;
    private String objectiveName;
    private String keyResultName;
}
