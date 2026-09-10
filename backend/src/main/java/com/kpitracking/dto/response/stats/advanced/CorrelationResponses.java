package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * DTO cho nhóm biểu đồ TƯƠNG QUAN ở tab "Chuyên sâu".
 *
 * <p>Khác với heatmap ma trận đang có (gộp mọi người vào một ô và chỉ còn lại con số đếm), các
 * biểu đồ ở đây giữ nguyên từng đánh giá thành một chấm, nên đọc được cả những trường hợp cá biệt
 * nằm lệch hẳn khỏi đám đông.
 */
public class CorrelationResponses {

    /** R1 — Phân tán "điểm hành vi × % hoàn thành KPI", chia bởi lưới ma trận của tổ chức. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BehaviorCompletionResponse {
        private String xLabel;
        private String yLabel;
        /** Trần trục, lấy từ dữ liệu thật nới ra một nhịp để chấm không dính mép. */
        private Double xMax;
        private Double yMax;
        /** Vạch chia dọc/ngang suy từ {@code Organization.performanceMatrix}; rỗng nếu chưa cấu hình. */
        private List<Double> xDividers;
        private List<Double> yDividers;
        private List<ScatterPoint> points;
        private Integer totalCount;
        /** true = cấp SELF: mọi chấm không phải của mình đều đã bị gỡ danh tính TỪ SERVER. */
        private Boolean anonymized;
    }

    /** Một chấm = một bản ghi đánh giá. Danh tính là {@code null} khi bị ẩn danh. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ScatterPoint {
        private UUID userId;
        private String name;
        private String orgUnitName;
        /** Trục X — % hoàn thành KPI. */
        private Double completion;
        /** Trục Y — điểm hành vi. */
        private Double behavior;
        /** 1..5, dùng để tô màu; null khi tổ chức chưa cấu hình ma trận. */
        private Integer rating;
        /** Chấm của chính người đang xem — FE làm nổi bật lên. */
        private Boolean isSelf;
        /**
         * Số KPI đã duyệt người này đang gánh trong phạm vi đang xem.
         * Không phải trục nào cả — nó trả lời câu hỏi ngay sau khi nhìn thấy một chấm lệch:
         * người đó đang ôm bao nhiêu việc. Một người 60% với 20 KPI khác hẳn 60% với 2 KPI.
         */
        private Integer kpiCount;
    }

    /** R2 - Phân tán "điểm BSC vs điểm hệ thống": chấm lệch xa đường y=x là nơi hai cách chấm mâu thuẫn. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscVsSystemScatterResponse {
        private List<AgreementPoint> points;
        private Double axisMax;
        /** SHADOW hay OFFICIAL - quyết định người đọc nên tin con số tới mức nào. */
        private String scoringMode;
        private Integer totalCount;
        private Boolean anonymized;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class AgreementPoint {
        private UUID userId;
        private String name;
        /** Trục X - điểm hệ thống. */
        private Double systemScore;
        /** Trục Y - điểm BSC. */
        private Double bscScore;
        /** bscScore - systemScore, dương nghĩa là BSC chấm rộng tay hơn. */
        private Double gap;
        private Integer evaluationCount;
        private Boolean isSelf;
    }

    /** R3 - Bong bóng hạng mục BSC: trọng số x điểm đạt x số KPI. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveBubbleResponse {
        private List<PerspectiveBubble> bubbles;
        /** Trọng số trung bình toàn bộ hạng mục - vạch chia "nặng ký hay không". */
        private Double avgWeight;
        /** Điểm trung bình - vạch chia "đạt hay chưa đạt". */
        private Double avgScore;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveBubble {
        private UUID perspectiveId;
        private String name;
        private String color;
        /** Trục X - trọng số (%). */
        private Double weightPercentage;
        /** Trục Y - điểm đạt trung bình. */
        private Double averageScore;
        /** Kích thước - số KPI thuộc hạng mục. */
        private Integer kpiCount;
    }
}
