package com.kpitracking.entity;

import com.kpitracking.enums.TopupOrderStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một đơn nạp tiền. Người dùng chuyển khoản với {@link #code} trong nội dung,
 * SePay bắn webhook về, hệ thống đối chiếu mã rồi ghi có.
 *
 * <p>{@link #amount} là số tiền ĐỀ NGHỊ, {@link #paidAmount} là số tiền THỰC
 * NHẬN. Hai cột tách nhau vì chính sách là luôn ghi có đúng số tiền thực về, kể
 * cả khi lệch: ví là số dư 1:1 chứ không phải món hàng giá cố định, và giữ tiền
 * người dùng lại trong hàng đợi đối soát chỉ vì lệch vài nghìn phí ngân hàng là
 * sai.
 *
 * <p>Cố ý KHÔNG có trường {@code sepayEventId}: ghép cặp đã có ở chiều ngược
 * ({@code SepayWebhookEvent.matchedOrder}), và một đơn có thể bị nhiều sự kiện
 * trỏ vào (một cái ghi có, một cái báo tiền về lần hai) nên một trường đơn trị
 * sẽ nói dối.
 */
@Entity
@Table(name = "topup_orders")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class TopupOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Mã đối soát nằm trong nội dung chuyển khoản. UNIQUE TOÀN CỤC, không scope
     * theo tổ chức: webhook chỉ thấy nội dung chuyển khoản chứ không biết org
     * nào, nên mã phải tự nó định danh được đơn. Sinh và trích bằng
     * {@code SepayCodeFormat}.
     */
    @Column(name = "code", nullable = false, length = 32)
    private String code;

    /** Số tiền người dùng đề nghị nạp. */
    @Column(name = "amount", nullable = false)
    private Long amount;

    /** Số tiền thực nhận theo webhook. Null khi chưa thanh toán. */
    @Column(name = "paid_amount")
    private Long paidAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TopupOrderStatus status = TopupOrderStatus.PENDING;

    /** Ảnh VietQR dựng sẵn để hiển thị. Không gọi API nào, chỉ là URL ảnh. */
    @Column(name = "qr_url", columnDefinition = "TEXT")
    private String qrUrl;

    /** Chụp lại cấu hình ngân hàng lúc tạo đơn, để đổi cấu hình không làm sai đơn cũ. */
    @Column(name = "bank_code", length = 20)
    private String bankCode;

    @Column(name = "bank_account_number", length = 50)
    private String bankAccountNumber;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    /** Bút toán ghi có tương ứng. Null khi chưa thanh toán. */
    @Column(name = "cash_transaction_id")
    private UUID cashTransactionId;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * Đơn còn có thể nhận tiền hay không. {@code CANCELLED} và {@code EXPIRED}
     * vẫn được ghi có: tiền đã về tài khoản thì phải ghi nhận, hết hạn hay đã huỷ
     * không phải cớ để nuốt tiền. Chỉ {@code PAID} là chặn, và chặn để không trả
     * hai lần chứ không phải để từ chối tiền.
     */
    public boolean isCreditable() {
        return status != TopupOrderStatus.PAID;
    }
}
