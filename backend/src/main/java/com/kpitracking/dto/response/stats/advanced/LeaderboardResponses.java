package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * DTO cho ba ô mở đầu trang Thống kê: bảng xếp hạng người, bảng xếp hạng đơn vị, và lưới nhiệt
 * đơn vị × đợt.
 *
 * <p>Mỗi hàng mang ĐỦ số để vẽ, không bắt giao diện gọi thêm lần nào: một bảng xếp hạng mà mỗi
 * hàng phải đi hỏi điểm hạnh kiểm riêng là mười lời gọi cho mười hàng.
 */
public class LeaderboardResponses {

    // ============================================================
    // Xếp hạng người
    // ============================================================

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PeopleLeaderboardResponse {
        private List<PersonRow> rows;
        /**
         * Cấp SELF không được thấy tên người khác. Giao diện đọc cờ này để nói rõ bảng đang ẩn
         * danh thay vì để người xem tưởng cả công ty đều tên "—".
         */
        private Boolean anonymized;
        /** Thang điểm hạnh kiểm của đợt/kỳ đang xem (4.0, 5.0…), để hiện "3,6/4". */
        private Double conductMax;
        /** Tổ chức chưa bật module Hạnh kiểm ⇒ cột giá trị cốt lõi không có gì để nói. */
        private Boolean conductEnabled;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonRow {
        private UUID userId;
        private String fullName;
        private String orgUnitName;
        /** Hiệu suất KPI đã được đánh giá trong đợt/kỳ, đơn vị %. */
        private Double kpiPercent;
        private Double conductScore;
        private Double conductMax;
        /** Nhãn xếp loại lấy từ `evaluation_levels` của tổ chức. */
        private String ratingName;
        private String ratingColor;
        private Boolean isSelf;
    }

    // ============================================================
    // Xếp hạng đơn vị
    // ============================================================

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitLeaderboardResponse {
        private List<UnitRow> rows;
        private Double conductMax;
        private Boolean conductEnabled;
        /** Tổ chức tắt BSC ⇒ cột "Đóng góp BSC" trống ở mọi hàng, nói ra để khỏi tưởng chưa tính. */
        private Boolean bscEnabled;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitRow {
        private UUID orgUnitId;
        private String orgUnitName;
        /** %đạt thẻ điểm BSC của chính đơn vị trong đợt; null khi đơn vị chưa có thẻ. */
        private Double bscPercent;
        /** Bình quân có trọng số %đạt các KPI của đơn vị — qua đúng bộ tính điểm của lõi. */
        private Double avgKpiPercent;
        private Integer kpiCount;
        private Double conductScore;
        private Double conductMax;
    }

    // ============================================================
    // Lưới nhiệt đơn vị × đợt
    // ============================================================

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitPeriodHeatmapResponse {
        private List<HeatmapPeriod> periods;
        private List<HeatmapUnitRow> units;
        /** `BSC` hay `EVALUATION` — ô lấy số từ đâu, để chú giải nói đúng thứ đang tô màu. */
        private String source;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HeatmapPeriod {
        private UUID id;
        private String name;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class HeatmapUnitRow {
        private UUID orgUnitId;
        private String name;
        /** Độ sâu so với đơn vị gốc của phạm vi — để thụt lề tên cho ra hình cây. */
        private Integer depth;
        /** Cùng thứ tự với `periods`; null = đợt đó chưa có số. */
        private List<Double> cells;
    }
}
