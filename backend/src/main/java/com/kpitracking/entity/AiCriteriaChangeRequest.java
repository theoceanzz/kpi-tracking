package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Đề nghị đổi quy chế chấm đang áp cho một đơn vị: cấp dưới muốn đơn vị dùng tài liệu của mình, nhưng tài liệu
 * đang áp do cấp trên áp nên không tự thay được. Người đã áp (hoặc cấp cao hơn) đồng ý thì đơn vị chuyển sang
 * tài liệu đề nghị.
 */
@Entity
@Table(name = "ai_criteria_change_requests")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AiCriteriaChangeRequest {

    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";
    public static final String CANCELLED = "CANCELLED";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "org_unit_id", nullable = false)
    private UUID orgUnitId;

    /** Tài liệu đang áp cho đơn vị lúc gửi (có thể đã bị xoá sau đó). */
    @Column(name = "current_set_id")
    private UUID currentSetId;

    @Column(name = "proposed_set_id", nullable = false)
    private UUID proposedSetId;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    /** Người được báo để quyết (người đã áp tài liệu hiện tại, hoặc cấp trên gần nhất). */
    @Column(name = "approver_id")
    private UUID approverId;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = PENDING;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    @Column(name = "decided_by")
    private UUID decidedBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "decided_at")
    private Instant decidedAt;
}
