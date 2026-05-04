package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
public class SummarySubData {

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class UnitComparisonData {
        private List<AnalyticsSummaryResponse.UnitComparison> topPerformingUnits;
        private List<AnalyticsSummaryResponse.UnitComparison> worstPerformingUnits;
        private List<AnalyticsSummaryResponse.UnitKpiComparison> unitKpiData;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RiskData {
        private List<AnalyticsSummaryResponse.RiskInfo> unitRisks;
        private List<AnalyticsSummaryResponse.RiskInfo> userRisks;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RankingData {
        private List<AnalyticsSummaryResponse.RankingItem> rankings;
        private List<AnalyticsSummaryResponse.RankingItem> kpiRankings;
        private List<AnalyticsSummaryResponse.RankingOption> rankingOptions;
    }
}
