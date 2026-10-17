package com.kpitracking.dto.response.evaluation;

import com.kpitracking.dto.response.bsc.PerspectiveScoreResponse;
import com.kpitracking.enums.bsc.BscScoringMode;
import lombok.*;

import java.util.List;

/** Preview of computed scores for a user in a period (used before saving a self/manager evaluation). */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationScorePreview {
    private Double systemScore;            // 0..maxScore, quantitative-only
    private Double behaviorScore;          // 0..5, weighted qualitative level (null if none scored)
    private Double kpiCompletionPercent;   // quantitative completion %
    private Integer matrixRating;          // 1..5 from performance matrix (null if not applicable)
    /** Điểm KPI thưởng đã quy về thang điểm — phần được cộng THÊM lên trên thang điểm. */
    private Double bonusScore;
    /** Trần điểm được phép lưu cho người này ở đợt này = thang điểm + bonusScore. */
    private Double maxAllowedScore;
    /** Tổng trọng số KPI định lượng (không tính KPI thưởng) dùng để quy điểm hệ thống về thang 100 —
     *  tính trên MỌI KPI được giao, kể cả KPI chưa nộp (tính 0). Phiếu chấm dùng số này để không
     *  quy đổi chỉ trên các bài đã nộp (làm 35% trọng số vẫn ra 100 điểm). */
    private Double quantitativeWeight;
    /** Quản lý đã chấm được người này chưa (chỉ có khi xem điểm của người khác). */
    private ScoringReadinessResponse scoringReadiness;

    // ── BSC (chỉ có giá trị khi org bật BSC và kỳ đã có bộ tiêu chí) ──────────────
    /** Điểm BSC (0..100). Luôn được tính kể cả ở chế độ SHADOW. */
    private Double bscScore;
    /** Chế độ chấm điểm của kỳ: SHADOW = chạy song song, OFFICIAL = bsc_score là điểm chính thức. */
    private BscScoringMode bscScoringMode;
    /** Điểm chính thức: = bscScore khi OFFICIAL, ngược lại = systemScore. */
    private Double officialScore;
    /** Breakdown điểm từng lĩnh vực. */
    private List<PerspectiveScoreResponse> bscPerspectives;
    /** % KPI tính điểm đã được gán lĩnh vực (100 = đủ). */
    private Double bscCoveragePercent;
    /** Tên các KPI tính điểm nhưng CHƯA gán lĩnh vực (cảnh báo cho người đánh giá). */
    private List<String> bscUnassignedKpis;
}
