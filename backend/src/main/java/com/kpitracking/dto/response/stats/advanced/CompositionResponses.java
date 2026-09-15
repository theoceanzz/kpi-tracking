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

    // ============================================================
    // T3 - Lịch sử thay đổi trọng số hạng mục (đường bậc thang)
    // ============================================================

}
