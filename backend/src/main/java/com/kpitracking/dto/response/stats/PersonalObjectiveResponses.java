package com.kpitracking.dto.response.stats;

import lombok.Builder;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class PersonalObjectiveResponses {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Metrics {
        private double averageProgress;
        private double averagePerformance;
        private int runningKpis;
        private int completedKpis;
        private int riskKpis;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ComboChartData {
        private List<ChartPoint> points;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartPoint {
        private String label;
        private int oldItems; 
        private int newItems; 
        private double completionTrend; 
        private double performanceTrend; 
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KpiDetail {
        private UUID kpiId;
        private String kpiName;
        private Double targetValue;
        private Double actualValue;
        private String unit;
        private Double progress;
        private Double performance;
        
        private String objectiveName;
        private String objectiveCode;
        private String keyResultName;
        private String keyResultCode;

        private Instant periodStart;
        private Instant periodEnd;

        private boolean isShared;
        private int participantCount;

        // Nhận diện loại KPI (để FE render tag: thường/thưởng/ngược/cha/con/thác nước)
        private Boolean isReverseKpi;
        private Boolean isBonusKpi;
        private UUID parentId;
        private com.kpitracking.enums.KpiParentRelationType parentRelationType; // quan hệ của chính nó với cha
        private com.kpitracking.enums.KpiParentRelationType childRelationType;  // loại con của nó (DECOMPOSITION=cha, DELEGATION=thác nước)
        private List<KpiDetail> children; // KPI con (kèm metrics), chỉ điền cho KPI cha/thác nước

        private List<SubmissionHistory> mySubmissions;
        private List<TeammateProgress> teammates;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubmissionHistory {
        private UUID id;
        private String code; 
        private Instant submitDate;
        private Double actualValue;
        private Double contributionProgress; 
        private Double performance;
        private String status;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeammateProgress {
        private UUID userId;
        private String avatarUrl;
        private String fullName;
        private String employeeCode;
        private String role;
        private String department;
        private Double actualValue;
        private Double progress;
        private Double performance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DrawerData {
        private String kpiName;
        private String krName;
        private String krCode;
        private String objName;
        private String objCode;
        private boolean isShared;
        private String unit;

        private Double targetValue;
        private Double myActualValue;
        private Double myProgress;
        private Double totalActualValue;
        private Double totalProgress;
        private Double myPerformance;
        private Double teamPerformance;

        private MultiAxisChartData chartData;
        private List<ContributionData> contributions;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MultiAxisChartData {
        private List<MultiAxisPoint> points;
        private List<TeammateLine> availableTeammates;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MultiAxisPoint {
        private String label;
        private Double targetValue;
        private Double teamTotalActual;
        private Double myActual;
        private Double myPerformance;
        private Map<String, TeammateValues> teammateValues;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeammateValues {
        private Double actual;
        private Double performance;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeammateLine {
        private UUID userId;
        private String fullName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContributionData {
        private UUID userId;
        private String fullName;
        private Double contributionPercentage;
        private Double actualValue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FilterOption {
        private String code;
        private String name;
        @Builder.Default private int depth = 0;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PagedKpiDetailResponse {
        private List<KpiDetail> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
        private List<FilterOption> availableObjectives;
        private List<FilterOption> availableKeyResults;
    }
}
