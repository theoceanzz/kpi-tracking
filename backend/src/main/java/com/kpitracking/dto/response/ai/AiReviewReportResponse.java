package com.kpitracking.dto.response.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Báo cáo giám sát chất lượng chấm (GĐ3): điểm AI đề xuất so với điểm quản lý đã chốt, theo từng người và
 * gộp. Cũng là bộ đo nghiệm thu GĐ1 (sai số trung bình ≤ 8 điểm, ≥ 70 % trong ±5 điểm).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiReviewReportResponse {
    /** Số người có CẢ điểm AI lẫn điểm quản lý — mẫu để tính sai số. */
    private int compared;
    /** Sai số tuyệt đối trung bình (điểm), {@code null} khi chưa có mẫu. */
    private Double meanAbsoluteError;
    /** Tỷ lệ (%) người có |AI − quản lý| ≤ 5 điểm. */
    private Double withinFivePercent;
    /** Trung bình (AI − quản lý): dương = AI chấm rộng tay hơn. */
    private Double meanBias;
    private List<Row> rows;
    private List<UnitRow> units;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Row {
        private UUID userId;
        private String userName;
        private String unitName;
        private UUID reviewId;
        private Double aiScore;
        private Double managerScore;
        /** AI − quản lý. */
        private Double difference;
        private String confidence;
    }

    /** Gộp theo đơn vị — để biết chỗ nào AI lệch nhiều. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UnitRow {
        private String unitName;
        private int compared;
        private Double meanAbsoluteError;
        private Double meanBias;
    }
}
