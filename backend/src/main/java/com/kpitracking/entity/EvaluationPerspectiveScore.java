package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Breakdown điểm BSC của một đánh giá theo từng viễn cảnh.
 * Lưu để HR đối chiếu/giải thích điểm và truy vết khi tranh chấp.
 */
@Entity
@Table(name = "evaluation_perspective_scores")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EvaluationPerspectiveScore {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluation_id", nullable = false)
    private Evaluation evaluation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "perspective_id", nullable = false)
    private BscPerspective perspective;

    @Column(name = "weight_percentage")
    private Double weightPercentage;

    /** Điểm thô viễn cảnh (0..150). NULL = nhân viên không có KPI nào trong viễn cảnh. */
    @Column(name = "raw_score")
    private Double rawScore;

    /** Đóng góp = weightPercentage% × rawScore. */
    @Column(name = "weighted_score")
    private Double weightedScore;

    @Column(name = "kpi_count", nullable = false)
    @Builder.Default
    private Integer kpiCount = 0;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
