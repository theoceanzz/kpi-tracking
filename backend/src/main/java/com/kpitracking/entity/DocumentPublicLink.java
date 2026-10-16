package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Link công khai của một tài liệu, sinh mỗi lần gửi tài liệu qua email ({@code DocumentEmailService}). Người nhận mở
 * được mà không cần tài khoản. Chỉ giữ băm của token; link trỏ tới bản hiện hành của tài liệu.
 */
@Entity
@Table(name = "document_public_links")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DocumentPublicLink {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    /** SHA-256 (hex) của token trong link. */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    /** To + Cc, cách nhau bằng dấu phẩy. */
    @Column(name = "recipients", nullable = false, columnDefinition = "TEXT")
    private String recipients;

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "sender_name", nullable = false)
    private String senderName;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    @Column(name = "view_count", nullable = false)
    @Builder.Default
    private Integer viewCount = 0;

    @Column(name = "last_viewed_at")
    private Instant lastViewedAt;

    /** Còn mở được: chưa thu hồi, chưa hết hạn. */
    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }
}
