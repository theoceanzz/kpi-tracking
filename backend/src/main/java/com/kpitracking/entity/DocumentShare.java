package com.kpitracking.entity;

import com.kpitracking.enums.DocumentSharePermission;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Chia sẻ một tài liệu cho đúng một người hoặc một đơn vị (thành viên đơn vị đó và các đơn vị con). Người được chia sẻ
 * đọc và tải được tài liệu, và K.AI đọc tài liệu đó khi trả lời họ. Quyền {@link DocumentSharePermission#EDIT} cho sửa
 * thêm NỘI DUNG trong trình soạn trực tuyến — vẫn không xoá, không di chuyển, không chia sẻ tiếp.
 */
@Entity
@Table(name = "document_shares")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentShare {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "grantee_user_id")
    private UUID granteeUserId;

    @Column(name = "grantee_unit_id")
    private UUID granteeUnitId;

    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false, length = 10)
    @Builder.Default
    private DocumentSharePermission permission = DocumentSharePermission.VIEW;

    @Column(name = "granted_by", nullable = false)
    private UUID grantedBy;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
