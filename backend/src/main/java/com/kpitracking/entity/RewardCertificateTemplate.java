package com.kpitracking.entity;

import com.kpitracking.enums.CertificateOrientation;
import com.kpitracking.enums.CertificateTemplateStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một mẫu chứng nhận khen thưởng của tổ chức.
 *
 * <p>Bản vẽ (khung viền, hoa văn, cách xếp chữ) KHÔNG nằm ở đây — nó là các "preset"
 * dựng sẵn bên frontend, entity này chỉ giữ lựa chọn của tổ chức: dùng preset nào, viết
 * lời gì, ai ký, màu thương hiệu ra sao. Nhờ vậy chỉnh một khoảng cách trên bản in không
 * kéo theo migration nào.
 *
 * <p>Các trường màu để null có chủ đích: null nghĩa là "giữ màu gốc của preset", khác hẳn
 * với việc chép màu preset xuống DB. Chép xuống thì mẫu cũ đóng băng ở bảng màu cũ và
 * không bao giờ được hưởng thiết kế cập nhật.
 */
@Entity
@Table(name = "reward_certificate_templates")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardCertificateTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    /**
     * Khoá thiết kế bên frontend. Cố tình là chuỗi tự do chứ không phải enum: danh mục
     * mẫu đẹp sẽ dài thêm theo thời gian, và thêm một mẫu vẽ mới không phải là chuyện
     * backend cần biết. Frontend lùi về preset đầu tiên khi gặp khoá lạ.
     */
    @Column(name = "preset", nullable = false, length = 40)
    private String preset;

    @Enumerated(EnumType.STRING)
    @Column(name = "orientation", nullable = false, length = 10)
    @Builder.Default
    private CertificateOrientation orientation = CertificateOrientation.LANDSCAPE;

    // ── Nội dung in trên chứng nhận ──────────────────────────────
    // Cho phép chỗ giữ {{ten}}, {{diem}}, {{lyDo}}, {{ngay}}, {{nguoiThuong}},
    // {{donVi}}, {{congTy}}. Frontend thay lúc vẽ — backend giữ nguyên văn để màn hình
    // soạn mẫu xem trước được bằng dữ liệu giả khi chưa có lượt thưởng nào.

    @Column(name = "eyebrow", length = 120)
    private String eyebrow;

    @Column(name = "title", nullable = false, length = 160)
    private String title;

    @Column(name = "subtitle", length = 255)
    private String subtitle;

    @Column(name = "body", columnDefinition = "TEXT")
    private String body;

    @Column(name = "footnote", length = 255)
    private String footnote;

    @Column(name = "signer_name", length = 120)
    private String signerName;

    @Column(name = "signer_title", length = 120)
    private String signerTitle;

    @Column(name = "signature_url", columnDefinition = "TEXT")
    private String signatureUrl;

    /** Null = dùng logo của tổ chức. Có cột riêng để công ty đặt được con dấu khác. */
    @Column(name = "logo_url", columnDefinition = "TEXT")
    private String logoUrl;

    @Column(name = "background_url", columnDefinition = "TEXT")
    private String backgroundUrl;

    @Column(name = "accent_color", length = 9)
    private String accentColor;

    @Column(name = "ink_color", length = 9)
    private String inkColor;

    @Column(name = "surface_color", length = 9)
    private String surfaceColor;

    @Column(name = "show_logo", nullable = false)
    @Builder.Default
    private Boolean showLogo = true;

    @Column(name = "show_points", nullable = false)
    @Builder.Default
    private Boolean showPoints = true;

    @Column(name = "show_reason", nullable = false)
    @Builder.Default
    private Boolean showReason = true;

    /** Mẫu được chọn sẵn khi mở màn hình in. Nhiều nhất một mẫu mỗi tổ chức. */
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private CertificateTemplateStatus status = CertificateTemplateStatus.ACTIVE;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
