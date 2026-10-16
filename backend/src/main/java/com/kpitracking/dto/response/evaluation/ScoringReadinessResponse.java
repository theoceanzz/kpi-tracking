package com.kpitracking.dto.response.evaluation;

import lombok.*;

import java.util.List;
import java.util.UUID;

/**
 * Một người đã đủ điều kiện để quản lý chấm đợt chưa — xem {@code EvaluationReadinessService}.
 * Giao diện dùng để khoá nút "Chấm điểm" kèm lý do; backend dùng cùng kết quả để chặn khi chốt.
 */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ScoringReadinessResponse {
    private UUID userId;
    /** Số KPI người này phải nộp trong đợt (không tính KPI thưởng, KPI cha phân rã). */
    private int requiredKpiCount;
    /** Số KPI trong đó đã có bài nộp tính được. */
    private int submittedKpiCount;
    /** Tên các KPI còn thiếu bài nộp. Rỗng khi tổ chức tắt bước nộp bài. */
    private List<String> missingKpiNames;
    /** Tổ chức đang bật bước tự đánh giá ⇒ phải tự đánh giá xong mới được chấm. */
    private boolean selfEvaluationRequired;
    private boolean selfEvaluated;
    /** Đợt đã kết thúc ⇒ chấm được luôn, KPI chưa nộp tính 0. */
    private boolean periodEnded;
    private boolean ready;
}
