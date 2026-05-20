package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScopedDashboardResponse {
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopScopedEntitiesResponse {
        private List<TopItem> topItems;
        private List<TopUnit> topUnits;
    }
    
    private ScopedMetrics metrics;
    private SubordinateStatsResponses.ComboChartResponse comboChart;
    private List<TopItem> topItems;
    private List<TopUnit> topUnits;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScopedMetrics {
        private Double completionRate;
        private Double performanceRate;
        private Integer completedCount;
        private Integer totalCount;
        private Integer atRiskCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopItem {
        private String id;
        private String name;
        private String code;
        private Double completionRate;
        private Double performanceRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopUnit {
        private String unitId;
        private String unitName;
        private String unitCode;
        private Double completionRate;
        private Double performanceRate;
    }
}
