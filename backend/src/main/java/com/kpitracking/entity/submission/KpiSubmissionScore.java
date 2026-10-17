package com.kpitracking.entity.submission;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Điểm MỘT chỉ tiêu do MỘT người chấm — để màn chấm hiện "Quản lý chấm" và "Sếp chấm" cạnh nhau.
 *
 * <p>{@link KpiSubmission#getManagerScore()} vẫn là điểm của người chấm cuối (các luồng tính điểm đọc ở đó, không
 * đổi); bảng này chỉ GIỮ LẠI điểm của từng cấp thay vì để cấp sau đè mất. Luật cấp bậc (cấp sau phải cao hơn cấp trước
 * — {@code KpiSubmissionService.requireCanReview}) nên thứ tự {@code createdAt} chính là thứ tự cấp.
 */
@Entity
@Table(name = "kpi_submission_scores")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiSubmissionScore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "submission_id", nullable = false)
    private UUID submissionId;

    @Column(name = "evaluator_id", nullable = false)
    private UUID evaluatorId;

    /** Thang trọng số thô, như {@code kpi_submissions.manager_score}. */
    @Column(name = "manager_score")
    private Double managerScore;

    @Column(name = "qualitative_level_id")
    private UUID qualitativeLevelId;

    /** Lần chấm đầu của người này — thứ tự cấp bậc. */
    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
