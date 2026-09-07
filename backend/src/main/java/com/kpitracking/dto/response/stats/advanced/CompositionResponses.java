package com.kpitracking.dto.response.stats.advanced;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO cho nhóm biểu đồ THÀNH PHẦN và THAY ĐỔI THEO THỜI GIAN ở tab thống kê.
 */
public class CompositionResponses {

    // ============================================================
    // T1 - Cơ cấu bài nộp theo thời gian (vùng chồng)
    // ============================================================

    /**
     * Mỗi điểm là một tháng; các trạng thái chồng lên nhau nên vừa đọc được tổng lượng nộp vừa
     * thấy phần chờ duyệt phình ra hay xẹp đi.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SubmissionCompositionResponse {
        private List<StatusMeta> statuses;
        private List<TimePoint> points;
        private Integer totalCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class StatusMeta {
        private String code;
        private String label;
        private String color;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TimePoint {
        private String label;
        /** Mã trạng thái đến số bài nộp trong mốc thời gian này. */
        private Map<String, Integer> values;
    }

    // ============================================================
    // P4 - Cơ cấu trạng thái bài nộp theo đơn vị (cột chồng 100%)
    // ============================================================

    /**
     * Chuẩn hoá về 100% để đơn vị 5 người và đơn vị 50 người so được với nhau — con số tuyệt đối
     * luôn khiến đơn vị lớn trông tệ hơn dù tỉ lệ tốt hơn.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class SubmissionShareResponse {
        private List<StatusMeta> statuses;
        private List<UnitShare> units;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitShare {
        private UUID orgUnitId;
        private String name;
        /** Mã trạng thái đến tỉ lệ phần trăm (đã chuẩn hoá, tổng bằng 100). */
        private Map<String, Double> percents;
        private Integer total;
    }

    // ============================================================
    // P2 - Cấu thành điểm BSC (thác nước)
    // ============================================================

    /**
     * Từ 0 cộng dồn phần đóng góp có trọng số của từng hạng mục để ra điểm BSC cuối.
     * Biểu đồ tròn chỉ nói được tỉ trọng, không nói được thứ tự cộng dồn và không xử lý phần âm.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscWaterfallResponse {
        private List<WaterfallStep> steps;
        private Double totalScore;
        private String scoringMode;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WaterfallStep {
        private String name;
        private String color;
        /** Phần điểm hạng mục này góp vào tổng. */
        private Double value;
        private Double weightPercentage;
        private Double rawScore;
        private Integer kpiCount;
        /** true = cột chốt (tổng), vẽ từ 0 thay vì nối tiếp bước trước. */
        private Boolean isTotal;
    }

    // ============================================================
    // T3 - Lịch sử thay đổi trọng số hạng mục (đường bậc thang)
    // ============================================================

    /**
     * Bảng {@code bsc_weight_history} là nơi duy nhất trong hệ thống lưu được giá trị CŨ của một
     * cấu hình. Nhờ nó mới trả lời được "trọng số hạng mục này từng là bao nhiêu, ai đổi, vì sao".
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WeightHistoryResponse {
        private List<PerspectiveMeta> perspectives;
        private List<WeightPoint> points;
        private Integer changeCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PerspectiveMeta {
        private UUID id;
        private String name;
        private String color;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class WeightPoint {
        /** ISO-8601 thời điểm đổi. */
        private String at;
        private String label;
        /** perspectiveId đến trọng số ĐANG hiệu lực sau lần đổi này. */
        private Map<String, Double> values;
        /** Mô tả lần đổi để hiện trong tooltip. */
        private String changeNote;
    }
}
