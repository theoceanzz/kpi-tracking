package com.kpitracking.dto.response.evaluation;

import lombok.*;

/** Preview of computed scores for a user in a period (used before saving a self/manager evaluation). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationScorePreview {
    private Double systemScore;            // 0..maxScore, quantitative-only
    private Double behaviorScore;          // 0..5, weighted qualitative level (null if none scored)
    private Double kpiCompletionPercent;   // quantitative completion %
    private Integer matrixRating;          // 1..5 from performance matrix (null if not applicable)
}
