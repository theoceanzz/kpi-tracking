package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Template email TUỲ CHỈNH của một tổ chức cho một loại mail.
 * Không có bản ghi ⇒ dùng mặc định trong {@code EmailTemplateCatalog},
 * nên bảng này chỉ chứa phần đã bị ghi đè — xoá bản ghi là quay về mặc định.
 */
@Entity
@Table(name = "email_templates")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EmailTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /** Mã loại mail, khớp với một mục trong EmailTemplateCatalog. */
    @Column(name = "template_code", nullable = false, length = 64)
    private String templateCode;

    @Column(name = "subject", nullable = false, length = 500)
    private String subject;

    /**
     * Chế độ cơ bản: đoạn HTML thân mail, hệ thống bọc khung header/footer.
     * Chế độ nâng cao ({@link #fullHtml} = true): toàn bộ tài liệu HTML, không bọc gì thêm.
     */
    @Column(name = "body", nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(name = "full_html", nullable = false)
    @Builder.Default
    private Boolean fullHtml = false;

    /** Tắt ⇒ loại mail này không gửi nữa (khác với việc chỉ sửa nội dung). */
    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;
}
