package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Nhật ký chiến dịch 360 — chỉ ghi thêm, giống {@link CycleUnitEvalEvent}.
 * {@link #detail} KHÔNG bao giờ chứa nội dung nhận xét.
 */
@Entity
@Table(name = "f360_events")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class F360Event {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "campaign_id", nullable = false)
    private F360Campaign campaign;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id")
    private F360Subject subject;

    @Column(name = "action", nullable = false, length = 40)
    private String action;

    /** Null = hệ thống (vd tự đóng khi quá hạn). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb")
    private String detail;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
