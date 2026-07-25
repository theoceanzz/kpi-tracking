package com.kpitracking.dto.response.kpi;

import com.kpitracking.enums.CycleEvaluationMode;
import lombok.*;

import java.util.List;
import java.util.UUID;

/** Điểm đánh giá theo kỳ của MỘT nhân viên (trung bình các đợt), 2 phía self/QLTT. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUserEvaluationResponse {
    private UUID userId;
    private String userName;
    private UUID orgUnitId;
    private String orgUnitName;
    private CycleEvaluationMode mode;
    /** Điểm nhân viên tự đánh giá (TB các đợt), null nếu chưa có. */
    private Double selfScore;
    /** Điểm cán bộ QLTT đánh giá (TB các đợt), null nếu chưa có. */
    private Double managerScore;

    /** Điểm CHỐT KỲ: đã nhập tay nếu có, ngược lại mặc định = managerScore. */
    private Double finalScore;
    /** true nếu điểm chốt do người đánh giá nhập tay (khác giá trị mặc định). */
    private boolean finalScoreOverridden;

    /** Mức định tính chấm ở cấp kỳ (0..5) — trục hàng ma trận. */
    private Double qualScore;
    /** Xếp loại 1..5 suy ra từ ma trận hiệu suất. */
    private Integer matrixRating;
    /** TB % hoàn thành định lượng các đợt — trục cột ma trận. */
    private Double avgCompletionPercent;

    private String comment;
    private String evaluatedByName;
    private java.time.Instant evaluatedAt;

    /** true nếu nhân viên thuộc một đơn vị đã CHỐT ⇒ không được chỉnh điểm. */
    private boolean locked;
    /** Tên đơn vị đã chốt đang khoá nhân viên này (để biết cần mở khoá ở đâu). */
    private String lockedByUnitName;

    /** Chi tiết từng đợt trong kỳ. */
    private List<PeriodBreakdown> periodBreakdown;

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PeriodBreakdown {
        private UUID periodId;
        private String periodName;
        private Double selfScore;
        private Double managerScore;
        private Double quantScore;
        private Double qualScore;
        private Integer matrixRating;
        /** % hoàn thành định lượng của đợt (kpi_completion_percent). */
        private Double completionPercent;
    }
}
