package com.kpitracking.dto.response.stats;

import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AnalyticsMyStatsResponse {

    private long totalAssignedKpi;
    private long totalSubmissions;
    private long approvedSubmissions;
    private long pendingSubmissions;
    private long rejectedSubmissions;
    private Double averageScore;

    private List<KpiProgressItem> kpiItems;
    private List<EvaluationItem> evaluationHistory;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class KpiProgressItem {
        private UUID kpiId;
        private String kpiName;
        private String unit;
        private Double targetValue;
        private Double actualValue;
        private double completionRate;
        private String status;
        private String orgUnitName;
    }

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EvaluationItem {
        private UUID id;
        private String kpiName;
        private Double score;
        private String comment;
        private String evaluatorName;
        private Instant createdAt;
    }
}
