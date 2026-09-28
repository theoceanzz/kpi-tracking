package com.kpitracking.entity;

import com.kpitracking.enums.KpiCycleEventAction;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lịch sử khoá / gia hạn / mở lại kỳ và cách xử lý từng đợt khi khoá. Chỉ ghi thêm, không sửa,
 * không xoá mềm — vừa là audit log, vừa là nguồn cho mục "Đợt đã chuyển đi" của kỳ cũ.
 */
@Entity
@Table(name = "kpi_cycle_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiCycleEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_cycle_id", nullable = false)
    private KpiCycle kpiCycle;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false)
    private KpiCycleEventAction action;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "period_id")
    private KpiPeriod period;

    /** Đợt mới sinh ra khi tách (PERIOD_SPLIT). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "new_period_id")
    private KpiPeriod newPeriod;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_cycle_id")
    private KpiCycle targetCycle;

    @Column(name = "old_end_date")
    private Instant oldEndDate;

    @Column(name = "new_end_date")
    private Instant newEndDate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "affected_kpi_ids", columnDefinition = "jsonb")
    private List<UUID> affectedKpiIds;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    /** Lý do do HỆ THỐNG ghi, dạng dịch được ({@code LocalizedText} JSON). Lý do người dùng nhập chỉ nằm ở {@link #reason}. */
    @Column(name = "reason_i18n", columnDefinition = "TEXT")
    private String reasonI18n;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    private Map<String, Object> detail;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
