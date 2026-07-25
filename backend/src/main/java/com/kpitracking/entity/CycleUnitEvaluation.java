package com.kpitracking.entity;

import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.CycleUnitEvalStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Đánh giá tổng hợp của một PHÒNG BAN theo một KỲ (đã chốt/nháp).
 * Điểm là snapshot gộp từ điểm kỳ của các nhân viên trong phòng.
 */
@Entity
@Table(name = "cycle_unit_evaluations")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id", nullable = false)
    private KpiCycle kpiCycle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_unit_id", nullable = false)
    private OrgUnit orgUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation_mode", nullable = false)
    private CycleEvaluationMode evaluationMode;

    @Column(name = "self_score")
    private Double selfScore;

    @Column(name = "manager_score")
    private Double managerScore;

    /** TB mức định tính của thành viên (thang 0..5). */
    @Column(name = "qual_score")
    private Double qualScore;

    /** TB xếp loại ma trận của thành viên (thang 1..5). */
    @Column(name = "matrix_rating")
    private Double matrixRating;

    @Column(name = "member_count")
    private Integer memberCount;

    @Column(name = "comment")
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private CycleUnitEvalStatus status = CycleUnitEvalStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finalized_by")
    private User finalizedBy;

    @Column(name = "finalized_at")
    private Instant finalizedAt;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
