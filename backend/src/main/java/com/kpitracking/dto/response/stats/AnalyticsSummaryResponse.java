package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsSummaryResponse {
    private UUID orgUnitId;
    private String orgUnitName;
    private String levelName;

    // 1. KPI Overview Cards
    private double kpiCompletionRate;
    private double avgPerformanceScore;
    private double overdueKpiRate;
    private long totalMembers;
    private long activeKpis;

    // 2. Trends (Line Chart)
    private List<TrendPoint> trendData;

    // 3. Sub-unit Comparison
    private List<UnitComparison> topPerformingUnits;
    private List<UnitComparison> worstPerformingUnits;
    private List<UnitKpiComparison> unitKpiData;

    // 4. Org Structure
    private List<OrgDistribution> memberDistribution;
    private List<RoleDistribution> roleDistribution;

    // 5. Risks
    private List<RiskInfo> unitRisks;
    private List<RiskInfo> userRisks;

    // 6. Ranking
    private List<RankingItem> rankings;
    private List<RankingItem> kpiRankings; // Ranking by completed KPI count
    private List<RankingOption> rankingOptions; 

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RankingOption {
        private UUID id;
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrendPoint {
        private String period; // e.g., "Jan", "Feb" or "Q1"
        private double kpiCompletion;
        private double performance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnitComparison {
        private String unitName;
        private double performance;
        private double completionRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnitKpiComparison {
        private String unitName;
        private long totalKpi;
        private long approvedKpi;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrgDistribution {
        private String name;
        private long value;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleDistribution {
        private String unitName;
        private long directorCount;
        private long headCount;
        private long staffCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskInfo {
        private String name;
        private String type; // UNIT or USER
        private double performance;
        private long overdueCount;
        private String riskLevel; // LOW, MEDIUM, HIGH
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RankingItem {
        private String name;
        private String avatar;
        private double score;
        private double performance;
        private long kpiCount;
        private String subText; // e.g., Department name
    }
}
