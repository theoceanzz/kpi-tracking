package com.kpitracking.entity;

import com.kpitracking.enums.ApprovalEventAction;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Lịch sử chuỗi duyệt. Chỉ ghi thêm, không sửa, không xoá. */
@Entity
@Table(name = "kpi_approval_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class KpiApprovalEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flow_id", nullable = false)
    private KpiApprovalFlow flow;

    @Column(name = "step_id")
    private UUID stepId;

    @Column(name = "step_order")
    private Integer stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 30)
    private ApprovalEventAction action;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_name")
    private String actorName;

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
