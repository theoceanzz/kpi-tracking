package com.kpitracking.dto.response.stats.advanced;

import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.stats.advanced.PersonDetailResponses.RatingLevelPoint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Trang thống kê chi tiết MỘT đơn vị — cả trang trong một lời gọi, song song với
 * {@link PersonDetailResponses}.
 *
 * <p>Khác trang nhân sự ở hai điểm có chủ ý: có bộ hình BSC (radar bốn lĩnh vực + xu hướng từng
 * lĩnh vực) và KHÔNG có danh sách KPI — câu hỏi về một đơn vị là "lĩnh vực nào đang kéo lùi", chứ
 * không phải "đơn vị này đang gánh những chỉ tiêu nào".
 */
public class UnitDetailResponses {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitDetailResponse {
        private UUID orgUnitId;
        private String name;
        private String parentName;
        /** Đợt mà hàng chỉ số và radar đang soi. */
        private String periodName;

        private UnitMetrics metrics;
        /** Radar: bốn lĩnh vực BSC của đợt đang soi. Rỗng khi tổ chức tắt BSC. */
        private List<BscAxisPoint> bsc;
        /** Cùng bốn lĩnh vực đó nhưng trải qua các đợt — nguồn của biểu đồ xu hướng. */
        private List<BscTrendPoint> bscTrend;
        private List<UnitTrendPoint> trend;
        private List<RatingLevelPoint> ratingLevels;
        /** Sổ đánh giá: kỳ → đợt. Không có KPI, khác trang nhân sự. */
        private List<UnitCycle> cycles;
        /** false ⇒ ba khung BSC trống là chuyện bình thường, giao diện nói ra thay vì để trắng. */
        private boolean bscEnabled;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitMetrics {
        /**
         * Đóng góp BSC, %. Lấy ĐÚNG con số mà bảng xếp hạng đơn vị hiện — xem
         * {@code LeaderboardService.unitRows}.
         */
        private Double bscPercent;
        private Double avgKpiPercent;
        private Integer kpiCount;
        private Double conductScore;
        private Double conductMax;
        private Integer memberCount;
    }

    /** Một trục radar = một lĩnh vực BSC cố định. */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscAxisPoint {
        private String code;
        private String name;
        private String color;
        /** null = lĩnh vực đó chưa có số. KHÔNG quy về 0 — "chưa có" khác "bằng không". */
        private Double percent;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BscTrendPoint {
        private UUID periodId;
        private String periodName;
        /** %đạt chung của đợt. */
        private Double achievementPercent;
        private Boolean gatePassed;
        /** Kết quả đợt còn nháp — số có thể đổi sau khi tính lại. */
        private boolean provisional;
        /** Cùng thứ tự với {@link UnitDetailResponse#bsc}. */
        private List<BscAxisPoint> axes;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitTrendPoint {
        private UUID periodId;
        private String periodName;
        private Double bscPercent;
        private String ratingName;
        private String ratingColor;
        /** Bậc 1..n trong {@code ratingLevels} — toạ độ Y của biểu đồ bậc xếp loại. */
        private Integer ratingIndex;
    }

    /**
     * Một KỲ của đơn vị: điểm chốt kỳ + các đợt bên trong.
     *
     * <p>{@code cycleId} null = nhóm gom các đợt không thuộc kỳ nào, luôn đứng cuối.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitCycle {
        private UUID cycleId;
        private String name;
        private Instant startDate;
        private Instant endDate;
        /** Nguyên văn {@code KpiCycleEvaluationService.getUnitCycleSummary} — không chép lại. */
        private CycleUnitEvaluationResponse evaluation;
        private List<UnitPeriod> periods;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UnitPeriod {
        private UUID periodId;
        private String name;
        private Instant startDate;
        private Instant endDate;
        private Double bscPercent;
        private Boolean gatePassed;
        private boolean provisional;
        /**
         * Xếp loại của ĐỢT, suy từ {@link #bscPercent} qua ngưỡng {@code evaluation_levels} — KHÁC
         * với {@code classification} ở hàng kỳ (cột đó chỉ tồn tại theo kỳ và áp luật phân bố mức
         * của thành viên). Đừng trộn hai thứ.
         */
        private String ratingName;
        private String ratingColor;
        private List<BscAxisPoint> axes;
    }
}
