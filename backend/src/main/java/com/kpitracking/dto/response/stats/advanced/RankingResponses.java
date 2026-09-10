package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * DTO cho nhóm XẾP HẠNG và SO SÁNH.
 */
public class RankingResponses {

    // ============================================================
    // C2 - Chênh lệch điểm so với trung bình
    // ============================================================

    /**
     * Vẽ thẳng phần LỆCH thay vì giá trị tuyệt đối: chiều dài thanh chính là mức lệch, không bắt
     * người đọc nhẩm trừ với một con số trung bình nằm ngoài biểu đồ.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DeviationResponse {
        private List<DeviationRow> rows;
        private Double baseline;
        private String baselineLabel;
        private String unit;
        private Boolean anonymized;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class DeviationRow {
        private UUID id;
        private String name;
        private String subText;
        /** Điểm trừ đi mốc: dương là trên mặt bằng chung. */
        private Double deviation;
        private Double score;
        private Boolean isSelf;
    }

    // ============================================================
    // C3 - Tự đánh giá vs quản lý đánh giá
    // ============================================================

    /**
     * Hai cột cạnh nhau cho mỗi đơn vị. Khoảng cách giữa chúng là mức chênh nhận thức — thứ không
     * xuất hiện ở bất kỳ báo cáo nào khác vì cả hai điểm đều được lưu nhưng chưa từng đặt cạnh nhau.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SelfVsManagerResponse {
        private List<SelfVsManagerRow> rows;
        private Double axisMax;
        /** Chênh lệch trung bình toàn phạm vi; dương nghĩa là đơn vị tự chấm cao hơn quản lý. */
        private Double averageGap;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SelfVsManagerRow {
        private UUID orgUnitId;
        private String name;
        private Double selfScore;
        private Double managerScore;
        private Double gap;
        private Integer memberCount;
    }

    // ============================================================
    // K2 - Biến động thứ hạng giữa hai kỳ
    // ============================================================

    /**
     * Thứ hạng tĩnh chỉ nói ai đang đứng đâu; cột kèm mũi tên nói thêm ai đang đi lên và ai đang
     * tụt — thông tin quyết định việc nên khen hay nên hỏi.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RankDeltaResponse {
        private List<RankDeltaRow> rows;
        private String currentCycleName;
        private String previousCycleName;
        private Double axisMax;
        /** Thiếu một trong hai kỳ thì không có gì để so — frontend hiện lời nhắc chọn kỳ. */
        private Boolean comparable;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RankDeltaRow {
        private UUID orgUnitId;
        private String name;
        private Double score;
        private Integer currentRank;
        private Integer previousRank;
        /** previousRank trừ currentRank: dương là thăng hạng. null nghĩa là kỳ trước chưa có mặt. */
        private Integer rankDelta;
        private Double scoreDelta;
    }
}
