package com.kpitracking.entity;

import com.kpitracking.enums.CycleEvaluationMode;
import com.kpitracking.enums.KpiCycleStatus;
import com.kpitracking.enums.KpiFrequency;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Kỳ đánh giá tổng hợp — gom nhiều {@link KpiPeriod} (đợt) để đánh giá tổng thể.
 * VD: đợt = KPI giao hàng tuần; kỳ = 6 tháng.
 */
@Entity
@Table(name = "kpi_cycles")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name; // e.g. "6 Tháng đầu năm 2026"

    /** Mẫu gợi ý (Tháng/Quý/6 Tháng/Năm) — thời gian vẫn chỉnh tự do, không cố định theo mẫu. */
    @Enumerated(EnumType.STRING)
    @Column(name = "cycle_type", nullable = false)
    private KpiFrequency cycleType;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "end_date")
    private Instant endDate;

    @Column(name = "description")
    private String description;

    /** Chế độ đánh giá cuối kỳ: định lượng / định tính / cả hai. */
    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation_mode", nullable = false)
    @Builder.Default
    private CycleEvaluationMode evaluationMode = CycleEvaluationMode.BOTH;

    /** OPEN → LOCKED (khoá kỳ) → OPEN (mở lại). Xem {@link KpiCycleStatus}. */
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private KpiCycleStatus status = KpiCycleStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locked_by")
    private User lockedBy;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reopened_by")
    private User reopenedBy;

    @Column(name = "reopened_at")
    private Instant reopenedAt;

    @Column(name = "reopen_reason")
    private String reopenReason;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public boolean isLocked() {
        return status == KpiCycleStatus.LOCKED;
    }
}
