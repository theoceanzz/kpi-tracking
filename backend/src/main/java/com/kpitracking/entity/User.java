package com.kpitracking.entity;

import com.kpitracking.entity.converter.EncryptedStringConverter;
import com.kpitracking.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "employee_code", unique = true)
    private String employeeCode;

    @Column(name = "phone")
    private String phone;

    @Column(name = "avatar_url")
    private String avatarUrl;

    /** HMAC-SHA256 của Lark open_id — chỉ để tra cứu, không lưu giá trị thật. */
    @Column(name = "lark_open_id_hash")
    private String larkOpenIdHash;

    /** Lark union_id, mã hoá AES-GCM. Không tra cứu theo cột này. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "lark_union_id_enc")
    private String larkUnionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "is_email_verified", nullable = false)
    @Builder.Default
    private Boolean isEmailVerified = false;

    @Column(name = "verify_email_token")
    private String verifyEmailToken;

    @Column(name = "verify_email_token_expiry")
    private Instant verifyEmailTokenExpiry;

    @Column(name = "reset_password_token")
    private String resetPasswordToken;

    @Column(name = "reset_password_token_expiry")
    private Instant resetPasswordTokenExpiry;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * Lúc tài khoản chuyển sang tạm dừng/tạm khoá hoặc bị xoá mềm; {@code null} khi đang hoạt động.
     * Mốc cho việc tự xoá tài liệu cá nhân sau N ngày (docs/DOCUMENTS_DESIGN.md §5.5).
     */
    @Column(name = "deactivated_at")
    private Instant deactivatedAt;

    @Column(name = "require_password_change", nullable = false)
    @Builder.Default
    private Boolean requirePasswordChange = false;

    @Column(name = "has_seen_onboarding", nullable = false)
    @Builder.Default
    private Boolean hasSeenOnboarding = false;

    @Column(name = "is_platform_admin", nullable = false)
    @Builder.Default
    private Boolean isPlatformAdmin = false;

    /**
     * Ngôn ngữ người dùng tự chọn ({@code SupportedLanguages}). Null = chưa chọn → theo ngôn ngữ mặc định
     * của tổ chức. Đừng đọc thẳng cột này để gửi email/thông báo: dùng {@code UserLanguageResolver}.
     */
    @Column(name = "preferred_language", length = 10)
    private String preferredLanguage;

    /**
     * Tài khoản đã bị tạm dừng (INACTIVE) hoặc tạm khóa (SUSPENDED) ở trang Quản lý tài khoản.
     * Mọi danh sách nhân sự ngoài trang đó phải bỏ những người này — cùng một quy tắc với
     * {@code deletedAt}: xoá mềm và tạm dừng đều là "không còn làm việc trong hệ thống".
     */
    public boolean isPausedAccount() {
        return status == UserStatus.INACTIVE || status == UserStatus.SUSPENDED;
    }
}
