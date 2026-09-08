package com.kpitracking.dto.response.stats;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO cho thống kê Ma trận xếp loại (tab "Ma trận đánh giá").
 * Gộp {@code matrix_rating / behavior_score / kpi_completion_percent} ĐÃ LƯU trên evaluations.
 */
public class MatrixAnalyticsResponses {

    /** Thẻ chỉ số + phân bố xếp loại + heatmap. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class OverviewResponse {
        private Double averageRating;      // /5
        private Double averageBehavior;    // /5
        private Double averageCompletion;  // %
        /**
         * Số NHÂN SỰ trong phạm vi, không phải số lượt đánh giá.
         *
         * <p>Mỗi người chỉ được tính một lần — bản đánh giá của đợt gần nhất. Gộp mọi đợt thì một
         * người có bao nhiêu đợt sẽ được đếm bấy nhiêu lần: đo thật, 18 nhân sự × 12 đợt ra 216.
         */
        private Integer personCount;
        /** rating 1..5 → số nhân sự (đủ 1..5, thiếu = 0). */
        private List<RatingBucket> distribution;
        /** null nếu org chưa cấu hình ma trận / cấu hình hỏng. */
        private Heatmap heatmap;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RatingBucket {
        private Integer rating;
        private Integer count;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class Heatmap {
        private String rowHeader;
        private String colHeader;
        private List<String> rows;          // dải điểm hành vi
        private List<String> cols;          // dải % hoàn thành
        private List<List<Integer>> ratings; // ratings[row][col] = xếp loại (từ cấu hình org)
        private List<List<Integer>> counts;  // counts[row][col] = số nhân sự rơi vào ô
    }

}
