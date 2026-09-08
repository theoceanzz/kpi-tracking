package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * DTO cho nhóm biểu đồ PHÂN PHỐI ở tab Phân cấp / KPI đơn vị.
 *
 * <p>Điểm chung: mọi phép tính gom nhóm (chia khoảng, tứ phân vị) đều làm xong ở server. Trả bản
 * ghi thô về trình duyệt vừa nặng vừa để lộ điểm từng người ở những cấp không được phép thấy.
 */
public class DistributionResponses {

    /** D1 — Histogram điểm đánh giá kèm vạch ngưỡng xếp loại của tổ chức. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ScoreHistogramResponse {
        private List<HistogramBin> bins;
        private List<LevelMarker> levels;
        private Integer totalCount;
        private Double averageScore;
        private Double maxScore;
        /** Điểm của chính người xem — cấp SELF dùng để đánh dấu vị trí mình trong đám đông ẩn danh. */
        private Double myScore;
        private Boolean anonymized;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HistogramBin {
        private Double from;
        private Double to;
        private String label;
        private Integer count;
    }

    /** Một mốc xếp loại (Xuất sắc / Tốt / …) để vẽ vạch dọc đúng màu cấu hình. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class LevelMarker {
        private String name;
        private Double threshold;
        private String color;
    }

    /** D2 — Hộp phân tán điểm theo đơn vị. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitBoxplotResponse {
        private List<BoxplotBox> boxes;
        private Double axisMax;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BoxplotBox {
        private UUID orgUnitId;
        private String name;
        private Double min;
        private Double q1;
        private Double median;
        private Double q3;
        private Double max;
        private Integer count;
    }

    /** D3 — Tháp cơ cấu nhân sự theo cấp tổ chức. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HeadcountPyramidResponse {
        private List<PyramidRow> rows;
        private String leftLabel;
        private String rightLabel;
        private Integer totalHeadcount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PyramidRow {
        private Integer levelOrder;
        private String name;
        /** Trưởng + Phó (rank 0,1). */
        private Integer left;
        /** Nhân viên (rank 2 trở lên). */
        private Integer right;
    }
}
