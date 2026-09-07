package com.kpitracking.enums;

/** Xếp hạng theo chỉ số nào. Chỉ ĐỌC từ phía đánh giá, không bao giờ ghi ngược. */
public enum RewardRankingMetric {
    /** Điểm chốt kỳ ({@code cycle_user_evaluations.final_score}). Chỉ dùng với scope CYCLE. */
    FINAL_SCORE,
    /** Xếp loại ma trận 1..5. Dùng được với cả hai scope. */
    MATRIX_RATING,
    /**
     * Điểm hiệu suất của đợt, lấy qua {@code EvaluationService} nên đã gói sẵn luật
     * thác nước và luật định tính. Chỉ dùng với scope PERIOD.
     */
    PERFORMANCE
}
