package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Điểm CHỐT KỲ của một nhân viên (người đánh giá nhập/chỉnh tay).
 * Mặc định gợi ý = trung bình điểm QLTT các đợt trong kỳ.
 */
@Entity
@Table(name = "cycle_user_evaluations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUserEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id", nullable = false)
    private KpiCycle kpiCycle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "final_score")
    private Double finalScore;

    /** Mức định tính chấm ở cấp kỳ (thang 0..5) — trục hàng của ma trận hiệu suất. */
    @Column(name = "qual_score")
    private Double qualScore;

    /** Xếp loại 1..5 suy ra từ ma trận: (qualScore) × (TB % hoàn thành định lượng). */
    @Column(name = "matrix_rating")
    private Integer matrixRating;

    @Column(name = "comment")
    private String comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluated_by")
    private User evaluatedBy;

    @Column(name = "evaluated_at")
    private Instant evaluatedAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
