package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO cho thống kê BSC (tab "Lĩnh vực" ở trang Thống kê).
 * Mọi điểm đều lấy từ dữ liệu ĐÃ LƯU (evaluations.bsc_score + evaluation_perspective_scores),
 * không tính lại — nhất quán với chỉ số "hiệu suất theo đánh giá".
 */
public class BscAnalyticsResponses {

    /** Metadata một lĩnh vực (dùng để FE tô màu / dựng series). */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveMeta {
        private UUID id;
        private String code;
        private String name;
        private String color;
        private Integer displayOrder;
    }

    /** GĐ "Xếp hạng theo BSC": bảng nhân sự phân trang + breakdown lĩnh vực. */
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
        /** perspectiveId (string) → điểm đạt trung bình của nhân sự ở lĩnh vực. */
        private Map<String, Double> perspectiveScores;
    }
}
