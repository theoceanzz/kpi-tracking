package com.kpitracking.dto.response.stats.advanced;

import com.kpitracking.dto.response.kpi.CycleUserEvaluationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Trang thống kê chi tiết MỘT người — cả trang trong một lời gọi.
 *
 * <p>Gộp làm một vì các nguồn sẵn có nằm dưới nhiều luật quyền khác nhau: điểm hạnh kiểm từng tiêu
 * chí chỉ có ở {@code GET /conduct/sheet} (đòi quyền CHẤM hạnh kiểm), còn điểm chốt kỳ chỉ có ở
 * {@code GET /kpi-cycles/{id}/evaluation/users/{userId}} (đòi {@code CYCLE_EVAL:VIEW}) — người chỉ
 * có quyền xem thống kê sẽ bị 403 đúng ở hai chỗ đó. Một endpoint của nhóm thống kê thì cả trang đi
 * chung một luật quyền, và mở trang là một lời gọi chứ không phải năm.
 */
public class PersonDetailResponses {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonDetailResponse {
        private UUID userId;
        private String fullName;
        private String email;
        private String avatarUrl;
        private String orgUnitName;
        /** Đợt mà hàng chỉ số đang soi — người đọc phải biết con số thuộc về đợt nào. */
        private String periodName;

        private PersonMetrics metrics;
        /** Một đỉnh radar cho mỗi tiêu chí hạnh kiểm; rỗng khi tổ chức tắt module Hạnh kiểm. */
        private List<ConductAxisPoint> conduct;
        private List<PersonTrendPoint> trend;
        /**
         * Thang xếp loại của tổ chức, xếp TĂNG DẦN theo ngưỡng (YẾU trước, XUẤT SẮC sau). Thứ tự này
         * chính là trục Y của biểu đồ bậc xếp loại: {@link PersonTrendPoint#ratingIndex} đánh số
         * 1..n theo đúng danh sách này.
         */
        private List<RatingLevelPoint> ratingLevels;
        /** Sổ đánh giá: kỳ → đợt → KPI. Thay cho danh sách KPI phẳng trộn lẫn mọi đợt. */
        private List<PersonCycle> cycles;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonMetrics {
        /**
         * Hiệu suất KPI đã được đánh giá, %. Đọc {@code Evaluation.kpiCompletionPercent} — ĐÚNG cột
         * mà bảng xếp hạng dùng, để con số ở trang chi tiết trùng khít hàng vừa bấm.
         */
        private Double performancePercent;
        private Double conductScore;
        private Double conductMax;
        private String ratingName;
        private String ratingColor;

        /**
         * Tỉ lệ kỳ nộp muộn hoặc thiếu bài, %. Mẫu số là số (KPI, đợt) người đó được giao;
         * một kỳ tính là TRỄ khi bài nộp đầu tiên tạo sau {@code kpi_periods.end_date}, hoặc
         * khi không có bài nào.
         */
        private Double latePercent;
        private Integer lateCount;
        private Integer totalCount;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ConductAxisPoint {
        private String criteriaName;
        /** Trọng số của tiêu chí trên tổng, %. */
        private Double weight;
        private Double selfScore;
        private Double managerScore;
        private Double maxScore;
        private Double minScore;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class RatingLevelPoint {
        private String name;
        private String color;
        private Double threshold;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonKpiRow {
        private UUID kpiId;
        private String name;
        private String kpiType;
        private String unit;
        private Double weight;
        private Double targetValue;
        private Double actualValue;
        /** null = KPI không tham gia tính điểm, hoặc định tính chưa chấm. */
        private Double attainmentPercent;
        private UUID periodId;
        private String periodName;
        private String status;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonTrendPoint {
        private UUID periodId;
        private String periodName;
        /** Hiệu suất KPI của đợt, %. */
        private Double performancePercent;
        private Double conductScore;
        /** Xếp loại của chính đợt đó. */
        private String ratingName;
        private String ratingColor;
        /** Bậc 1..n trong {@link PersonDetailResponse#ratingLevels}; null khi đợt chưa có đánh giá. */
        private Integer ratingIndex;
    }

    /**
     * Một KỲ đánh giá của người này: điểm chốt kỳ + các đợt bên trong.
     *
     * <p>{@code cycleId} null = nhóm gom các đợt KHÔNG thuộc kỳ nào ({@code kpi_periods.kpi_cycle_id}
     * cho phép null). Nhóm đó luôn đứng cuối và không có điểm cấp kỳ.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonCycle {
        private UUID cycleId;
        private String name;
        private Instant startDate;
        private Instant endDate;
        /**
         * Nguyên văn kết quả của {@code KpiCycleEvaluationService.getUserCycleEvaluation} — không
         * chép lại sang DTO riêng để hai màn (sổ này và màn chốt kỳ) không bao giờ lệch nhau.
         */
        private CycleUserEvaluationResponse evaluation;
        private List<PersonPeriod> periods;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PersonPeriod {
        private UUID periodId;
        private String name;
        private Instant startDate;
        private Instant endDate;

        private Double selfScore;
        private Double managerScore;
        private Double quantScore;
        private Double qualScore;
        private Double completionPercent;
        private Integer matrixRating;
        private String ratingName;
        private String ratingColor;

        /** Mỗi người chấm một dòng, xếp theo lần chấm đầu (quản lý trước, sếp sau). */
        private List<EvaluatorScore> evaluators;
        private List<PersonKpiRow> kpis;
    }

    /**
     * Một dòng {@code evaluations}: ai chấm và chấm bao nhiêu.
     *
     * <p>Hệ thống KHÔNG có enum loại người chấm — "tự chấm" suy ra từ việc người chấm trùng người
     * được chấm, còn lại phân biệt bằng tên vai trò tại đơn vị.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EvaluatorScore {
        private UUID evaluatorId;
        private String evaluatorName;
        private String evaluatorRoleName;
        private boolean self;

        private Double score;
        private Double systemScore;
        private Double bscScore;
        private Double behaviorScore;
        private Double kpiCompletionPercent;
        private Integer matrixRating;
        private String comment;
        private Instant evaluatedAt;
    }
}
