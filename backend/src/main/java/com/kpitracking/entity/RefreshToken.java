package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "token", nullable = false, unique = true)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked", nullable = false)
    @Builder.Default
    private Boolean revoked = false;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "device_info")
    @Builder.Default
    private String deviceInfo = "Unknown Device";

    /**
     * Token ngay trước lần xoay gần nhất — vẫn được nhận tới {@link #previousValidUntil} (ân hạn), để các tab
     * cùng làm mới phiên một lúc không đá nhau ra (V40).
     */
    @Column(name = "previous_token")
    private String previousToken;

    @Column(name = "previous_valid_until")
    private Instant previousValidUntil;
}
