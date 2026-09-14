package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Một dòng nhật ký bảo mật — xem {@code security_audit_logs} ở cuối V1__init_schema.sql. */
@Entity
@Table(name = "security_audit_logs")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SecurityAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "event", nullable = false, length = 64)
    private String event;

    @Column(name = "outcome", nullable = false, length = 16)
    private String outcome;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_email")
    private String userEmail;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "ip", length = 64)
    private String ip;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    /** = MDC requestId / header X-Request-Id của request đã sinh ra sự kiện; null với job nền. */
    @Column(name = "request_id", length = 64)
    private String requestId;

    @Column(name = "target_type", length = 64)
    private String targetType;

    @Column(name = "target_id", length = 128)
    private String targetId;

    @Column(name = "detail", length = 1000)
    private String detail;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
