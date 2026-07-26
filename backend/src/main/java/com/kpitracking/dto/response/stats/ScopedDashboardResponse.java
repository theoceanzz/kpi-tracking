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
        // KPI định tính (chỉ có nghĩa khi scope là 1 KPI): đầu ra là MỨC → biểu đồ phân bố mức.
        private com.kpitracking.enums.KpiType kpiType;
        private String qualitativeLevelName;
        private java.util.List<com.kpitracking.util.QualitativeKpiUtil.LevelBucket> qualitativeDistribution;
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
