package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class SubordinateStatsResponses {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricValueResponse {
        private Double value;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompletedCountResponse {
        private Integer completed;
        private Integer total;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CountResponse {
        private Integer count;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComboChartResponse {
        private List<ChartPoint> points;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        public static class ChartPoint {
            private String label;
            private Integer oldItems;
            private Integer newItems;
            private Double completionTrend;
            private Double performanceTrend;
        }
    }
}
