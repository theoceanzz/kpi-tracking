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
        private UUID unitId;
        private String unitName;
        private String unitCode;
        private Instant startDate;
        private Instant endDate;
        private Double progress;
        private Double performance;
        private Integer completedKeyResults;
        private Integer totalKeyResults;
        // Số đợt (kpiPeriod) distinct của các KPI con + danh sách tên đợt (cho cột "Đợt" thông minh).
        private Integer periodCount;
        private List<String> periodNames;
        private List<KeyResultDetailedDto> keyResults;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrgUnitFilterDto {
        private UUID id;
        private String name;
        private String code;
        private int depth;
        private List<OrgUnitFilterDto> children;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PagedObjectiveDetailedResponse {
        private List<ObjectiveDetailedDto> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KrUnitDto {
        private UUID orgUnitId;
        private String orgUnitName;
        private String orgUnitCode;
        private Double weightPercentage;
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
        private List<KrUnitDto> assignedUnits;
        private Instant startDate;
        private Instant endDate;
        private Integer periodCount;
        private List<String> periodNames;
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
        private Double targetValue;
        private String unit;
        private String unitName;
        private String unitCode;
        private Instant startDate;
        private Instant endDate;
        private String periodName;   // tên đợt, vd "Tháng 6/2026"
        private Double weight;        // trọng số KPI
        private String assigneeName;  // người đảm nhiệm
        private List<KpiParticipantDto> participants;

        // Nhận diện loại KPI (tag: thường/thưởng/ngược/cha/con/thác nước) + KPI con kèm metrics
        private Boolean isReverseKpi;
        private Boolean isBonusKpi;
        private UUID parentId;
        private com.kpitracking.enums.KpiParentRelationType parentRelationType;
        private com.kpitracking.enums.KpiParentRelationType childRelationType;
        private List<KpiDetailedDto> children;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KpiParticipantDto {
        private UUID userId;
        private String avatarUrl;
        private String fullName;
        private String employeeCode;
        private String roleName;
        private String orgUnitName;
        private Double progress;
        private Double performance;
        private Double actualValue;
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
