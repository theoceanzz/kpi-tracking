package com.kpitracking.entity;

import com.kpitracking.enums.SepayEventStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một callback biến động số dư từ SePay, lưu nguyên vẹn kể cả khi không khớp đơn
 * nào — mất webhook là mất tiền của người dùng, và {@link #rawPayload} là thứ
 * duy nhất cứu được.
 *
 * <p><b>Đây KHÔNG phải bảng append-only thuần</b> như {@link CashTransaction},
 * nói rõ ra để không ai tưởng nhầm. Ba nhóm trường, mỗi nhóm ghi đúng MỘT lần:
 * <ol>
 *   <li>{@code rawPayload} và mọi trường trích từ nó — ghi lúc nhận, bất biến tuyệt đối</li>
 *   <li>{@code status} / {@code matchedOrder} / {@code amountMismatch} / {@code errorMessage}
 *       — ghi lúc xử lý tự động</li>
 *   <li>{@code resolution*} — ghi khi có người xử lý tay</li>
 * </ol>
 *
 * <p>Không có nhóm thứ ba thì mọi dòng {@code UNMATCHED} sẽ nằm lại vĩnh viễn kể
 * cả sau khi tiền đã được ghi có bằng tay, hàng đợi đối soát tích rác dần theo
 * thời gian và endpoint đối soát không bao giờ trả về sạch.
 */
@Entity
@Table(name = "sepay_webhook_events")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SepayWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Id giao dịch phía SePay. Unique để một lần gửi lại không ghi có hai lần. */
    @Column(name = "sepay_id", nullable = false)
    private Long sepayId;

    @Column(name = "gateway", length = 100)
    private String gateway;

    @Column(name = "transaction_date")
    private Instant transactionDate;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "sub_account", length = 50)
    private String subAccount;

    /** Mã đối soát do SePay trích theo tiền tố cấu hình trên dashboard. Có thể null. */
    @Column(name = "code", length = 64)
    private String code;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    /** "in" là tiền vào, "out" là tiền ra. Chỉ "in" mới liên quan tới nạp ví. */
    @Column(name = "transfer_type", length = 10)
    private String transferType;

    @Column(name = "transfer_amount")
    private Long transferAmount;

    @Column(name = "accumulated")
    private Long accumulated;

    @Column(name = "reference_code")
    private String referenceCode;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", columnDefinition = "jsonb", nullable = false)
    private String rawPayload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private SepayEventStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "matched_order_id")
    private TopupOrder matchedOrder;

    /** Tiền về lệch so với số đề nghị. Vẫn ghi có đủ, nhưng cần người xác nhận. */
    @Column(name = "amount_mismatch", nullable = false)
    @Builder.Default
    private Boolean amountMismatch = false;

    /**
     * Lý do không ghi có được, viết cho người đối soát đọc chứ không phải cho lập
     * trình viên: phải nêu cả các khả năng và cách xử lý tương ứng, vì người đọc
     * không tự phân biệt được "người dùng chuyển lần hai" với "webhook về muộn
     * sau khi đã gán tay".
     */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolved_by")
    private User resolvedBy;

    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    /** Bút toán sinh ra khi xử lý tay. Null với cách xử lý bỏ qua. */
    @Column(name = "resolution_transaction_id")
    private UUID resolutionTransactionId;

    @CreatedDate
    @Column(name = "received_at", updatable = false, nullable = false)
    private Instant receivedAt;

    /** Có nằm trong hàng đợi đối soát không. Khớp đúng điều kiện của idx_sepay_events_queue. */
    public boolean isInReconcileQueue() {
        return resolvedAt == null
                && (status == SepayEventStatus.UNMATCHED || Boolean.TRUE.equals(amountMismatch));
    }
}
