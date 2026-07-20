package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO cho thống kê BSC (tab "Viễn cảnh" ở trang Thống kê).
 * Mọi điểm đều lấy từ dữ liệu ĐÃ LƯU (evaluations.bsc_score + evaluation_perspective_scores),
 * không tính lại — nhất quán với chỉ số "hiệu suất theo đánh giá".
 */
public class BscAnalyticsResponses {

    /** Metadata một viễn cảnh (dùng để FE tô màu / dựng series). */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveMeta {
        private UUID id;
        private String code;
        private String name;
        private String color;
        private Integer displayOrder;
    }

    /** Một viễn cảnh trong biểu đồ cân bằng (radar) của phạm vi đang chọn. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectivePoint {
        private UUID perspectiveId;
        private String code;
        private String name;
        private String color;
        private Integer displayOrder;
        private Double weightPercentage;
        /** Điểm đạt trung bình có trọng số của viễn cảnh (0..150), null nếu không có dữ liệu. */
        private Double averageScore;
        private Double weightedScore;
        private Integer kpiCount;
    }

    /** GĐ "Cân bằng viễn cảnh": thẻ chỉ số + dữ liệu radar. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BalanceResponse {
        private Double averageBscScore;
        private Double averageSystemScore;
        private Integer evaluationCount;
        /** SHADOW / OFFICIAL / null (kỳ chưa có thẻ điểm). */
        private String scoringMode;

        private String strongestPerspective;
        private Double strongestScore;
        private String weakestPerspective;
        private Double weakestScore;

        /** % KPI tính điểm BSC đã được gán viễn cảnh (0..100). */
        private Double coveragePercent;
        private Integer mappedKpiCount;
        private Integer unmappedKpiCount;
        private List<String> unmappedKpiNames;

        private List<PerspectivePoint> perspectives;
    }

    /** GĐ "Xu hướng": mỗi cột là một mốc (kỳ), mỗi viễn cảnh một series + đường tổng BSC. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrendResponse {
        private List<PerspectiveMeta> perspectives;
        private List<TrendPoint> points;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrendPoint {
        private String label;
        private Double overall;
        /** perspectiveId (string) → điểm đạt trung bình tại mốc này. */
        private Map<String, Double> values;
    }

    /** GĐ "So sánh giữa đơn vị": mỗi đơn vị × điểm từng viễn cảnh + điểm BSC/hệ thống tổng. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitComparisonResponse {
        private List<PerspectiveMeta> perspectives;
        private List<UnitRow> units;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitRow {
        private UUID orgUnitId;
        private String orgUnitName;
        private Double overallBsc;
        private Double overallSystem;
        private Integer evaluationCount;
        private Map<String, Double> values;
    }

    /** GĐ "Kiểm chứng SHADOW": đối chiếu bsc_score vs system_score theo đơn vị/nhân sự. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscVsSystemResponse {
        /** UNIT | MEMBER. */
        private String level;
        private String scoringMode;
        private List<BscVsSystemRow> rows;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscVsSystemRow {
        private UUID id;
        private String name;
        private Double bscScore;
        private Double systemScore;
        private Integer evaluationCount;
    }

    /** GĐ "Xếp hạng theo BSC": bảng nhân sự phân trang + breakdown viễn cảnh. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RankingResponse {
        private List<PerspectiveMeta> perspectives;
        private List<RankingRow> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private boolean first;
        private boolean last;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RankingRow {
        private UUID userId;
        private String fullName;
        private String email;
        private Double bscScore;
        private Double systemScore;
        private Integer evaluationCount;
        /** perspectiveId (string) → điểm đạt trung bình của nhân sự ở viễn cảnh. */
        private Map<String, Double> perspectiveScores;
    }
}
