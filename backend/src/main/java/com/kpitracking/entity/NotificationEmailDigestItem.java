package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một thông báo đang xếp hàng chờ gửi email.
 *
 * <p>Sự kiện không gửi thư ngay mà đẩy vào đây; scheduler chờ luồng sự kiện của người
 * nhận lắng xuống rồi gộp tất cả mục chưa gửi của họ thành MỘT lá thư. Thông báo trong
 * hệ thống (chuông) vẫn đi tức thời, chỉ kênh email bị gom.
 *
 * <p>Email và tên người nhận được chốt ngay lúc xếp hàng — người dùng có thể đổi địa chỉ
 * giữa lúc sự kiện xảy ra và lúc thư thật sự đi.
 */
@Entity
@Table(name = "notification_email_digest_items")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationEmailDigestItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    @Column(name = "recipient_name")
    private String recipientName;

    @Column(name = "event_code", nullable = false)
    private String eventCode;

    @Column(name = "title", nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "reference_id")
    private UUID referenceId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /** NULL = còn chờ gửi. */
    @Column(name = "sent_at")
    private Instant sentAt;
}
