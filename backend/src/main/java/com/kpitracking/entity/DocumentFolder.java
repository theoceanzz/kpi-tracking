package com.kpitracking.entity;

import com.kpitracking.enums.DocumentScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

/**
 * Thư mục của thư viện tài liệu — cùng luật phạm vi với {@link Document} (cá nhân / đơn vị / công ty). Tài liệu
 * trong thư mục phải cùng phạm vi, cùng chủ hoặc cùng đơn vị với thư mục (DocumentFolderService kiểm).
 */
@Entity
@Table(name = "document_folders")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentFolder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20)
    private DocumentScope scope;

    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(name = "org_unit_id")
    private UUID orgUnitId;

    /** Thư mục cha; {@code null} = nằm ở gốc của phạm vi. */
    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "name", nullable = false)
    private String name;

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
