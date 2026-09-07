package com.kpitracking.entity;

import com.kpitracking.enums.CycleUnitEvalAction;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Lịch sử chốt / mở khoá đánh giá kỳ của một đơn vị.
 * Đây là audit log thuần: chỉ ghi thêm, không sửa, không soft-delete —
 * nhờ vậy timeline vẫn giữ được vết dù {@link CycleUnitEvaluation} bị mở khoá
 * (mở khoá sẽ xoá finalizedBy/finalizedAt trên bản ghi chính).
 */
@Entity
@Table(name = "cycle_unit_eval_events")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CycleUnitEvalEvent {

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
    @Column(name = "action", nullable = false)
    private CycleUnitEvalAction action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    /** Vai trò + cấp bậc của người thao tác, chụp lại lúc xảy ra sự kiện. */
    @Column(name = "actor_role_name")
    private String actorRoleName;

    @Column(name = "actor_role_level")
    private Integer actorRoleLevel;

    @Column(name = "actor_role_rank")
    private Integer actorRoleRank;

    /** Điểm của đơn vị tại thời điểm xảy ra sự kiện. */
    @Column(name = "manager_score")
    private Double managerScore;

    @Column(name = "qual_score")
    private Double qualScore;

    @Column(name = "matrix_rating")
    private Double matrixRating;

    @Column(name = "member_count")
    private Integer memberCount;

    @Column(name = "comment")
    private String comment;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
