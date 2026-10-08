package com.kpitracking.entity;

import com.kpitracking.enums.DocumentScope;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Đề xuất đưa một tài liệu lên phạm vi rộng hơn (đơn vị / công ty) — docs/DOCUMENTS_DESIGN.md §16.2. Duyệt = sao chép
 * thành tài liệu mới ở phạm vi đích ({@code resultDocumentId}); tài liệu gốc giữ nguyên.
 */
@Entity
@Table(name = "document_promotion_requests")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentPromotionRequest {

    public enum Status { PENDING, APPROVED, REJECTED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_scope", nullable = false, length = 20)
    private DocumentScope targetScope;

    @Column(name = "target_unit_id")
    private UUID targetUnitId;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "decided_by")
    private UUID decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decision_note", columnDefinition = "TEXT")
    private String decisionNote;

    @Column(name = "result_document_id")
    private UUID resultDocumentId;
}
