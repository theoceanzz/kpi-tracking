package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class SubordinateDetailsResponses {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ObjectiveDetailedDto {
        private UUID id;
        private String name;
        private String code;
        private String unitName;
        private String unitCode;
        private Instant startDate;
        private Instant endDate;
        private Double progress;
        private Double performance;
        private Integer completedKeyResults;
        private Integer totalKeyResults;
        private List<KeyResultDetailedDto> keyResults;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyResultDetailedDto {
        private UUID id;
        private String name;
        private String code;
        private Double progress;
        private Double performance;
        private String unitName;
        private String unitCode;
        private Instant startDate;
        private Instant endDate;
        private List<KpiDetailedDto> kpis;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KpiDetailedDto {
        private UUID id;
        private String name;
        private String status;
        private Double progress;
        private Double performance;
        private String unitName;
        private String unitCode;
        private Instant startDate;
        private Instant endDate;
        private List<KpiSubmissionDto> submissions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KpiSubmissionDto {
        private UUID id;
        private Double actualValue;
        private String note;
        private String status;
        private Instant createdAt;
        private String submittedByName;
        private String submittedByCode;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopEntitiesDashboardResponse {
        private List<TopObjectiveDto> topObjectives;
        private List<TopUnitDto> topUnits;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopObjectiveDto {
        private UUID id;
        private String name;
        private String code;
        private Double completionRate;
        private Double performanceRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopUnitDto {
        private String unitName;
        private Double completionRate;
        private Double performanceRate;
    }
}
