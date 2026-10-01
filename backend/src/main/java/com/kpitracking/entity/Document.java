package com.kpitracking.entity;

import com.kpitracking.enums.DocumentAiStatus;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.enums.StorageProvider;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

/**
 * Một tài liệu trong thư viện 3 phạm vi (docs/DOCUMENTS_DESIGN.md). Đây là GỐC: tệp, người sở hữu, phạm vi.
 * Vector trong kho tri thức chỉ là bản sao dựng lại được, nối về đây qua {@code metadata.docId}.
 *
 * <p>Không giữ URL tệp: {@link #storageKey} chỉ backend đọc, tải về luôn qua endpoint kiểm quyền.
 */
@Entity
@Table(name = "documents")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20)
    private DocumentScope scope;

    /*
     * Người/đơn vị để dạng UUID chứ không @ManyToOne: User và OrgUnit có @SQLRestriction("deleted_at IS NULL"),
     * nên nạp quan hệ tới một người đã nghỉ (tài liệu công ty họ từng tải lên) sẽ ném EntityNotFound. Tên
     * hiển thị tra theo lô lúc dựng response (DocumentService.names).
     */

    /** Chỉ khi {@link DocumentScope#PERSONAL}. */
    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    /** Chỉ khi {@link DocumentScope#UNIT}. */
    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    @Builder.Default
    private DocumentCategory category = DocumentCategory.OTHER;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "content_sha256", nullable = false, length = 64)
    private String contentSha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_provider", nullable = false, length = 20)
    private StorageProvider storageProvider;

    @Column(name = "storage_key", nullable = false, columnDefinition = "TEXT")
    private String storageKey;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(name = "ai_enabled", nullable = false)
    @Builder.Default
    private Boolean aiEnabled = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "ai_status", nullable = false, length = 20)
    @Builder.Default
    private DocumentAiStatus aiStatus = DocumentAiStatus.PENDING;

    @Column(name = "ai_chunk_count", nullable = false)
    @Builder.Default
    private Integer aiChunkCount = 0;

    /** Lý do nạp hỏng, dạng {@code LocalizedText} JSON — dịch lúc đọc theo ngôn ngữ người xem. */
    @Column(name = "ai_error_i18n", columnDefinition = "TEXT")
    private String aiErrorI18n;

    @Column(name = "ai_indexed_at")
    private Instant aiIndexedAt;

    /** Tài liệu cũ (rag_documents) mà tài liệu này thay thế; nạp xong thì xoá bản cũ rồi đặt lại null. */
    @Column(name = "legacy_rag_document_id")
    private UUID legacyRagDocumentId;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
