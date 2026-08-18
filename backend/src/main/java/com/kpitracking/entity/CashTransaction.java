package com.kpitracking.entity;

import com.kpitracking.enums.CashSourceType;
import com.kpitracking.enums.CashTransactionType;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một dòng sổ cái ví tiền. Số tiền tính bằng ĐỒNG.
 *
 * <p>Bảng CHỈ GHI THÊM — không {@code updated_at}, không {@code deleted_at},
 * không {@code @SQLRestriction} (theo đúng tiền lệ {@link RewardTransaction} và
 * {@link CycleUnitEvalEvent}), không bao giờ sửa hay xoá dòng đã ghi.
 *
 * <p>Cố ý KHÔNG có {@code reversalOfTransactionId} dù {@link RewardTransaction}
 * có: ví tiền không có luồng nào đảo bút toán, nên cột đó sẽ vĩnh viễn rỗng.
 * Thêm lại bằng một migration mới khi thật sự cần thì rẻ hơn nhiều so với mang
 * theo một cột không ai ghi.
 *
 * <p>Chỉ {@code CashWalletService.applyTransaction} được phép tạo bản ghi ở đây.
 */
@Entity
@Table(name = "cash_transactions")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private CashWallet wallet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Có dấu: TOPUP dương, CONVERT âm, ADJUST tuỳ ý nghĩa. Không bao giờ bằng 0. */
    @Column(name = "amount", nullable = false)
    private Long amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private CashTransactionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private CashSourceType sourceType;

    /** Id bản ghi nghiệp vụ sinh ra bút toán: đơn nạp, hoặc sự kiện SePay. */
    @Column(name = "source_ref_id")
    private UUID sourceRefId;

    /**
     * Chống ghi trùng khi retry mạng hoặc bấm hai lần. Bắt buộc có (NOT NULL) để
     * ép mọi luồng mới phải nghĩ ra khoá thay vì lặng lẽ bỏ trống và mất lớp bảo
     * vệ. Xem bảng đăng ký khoá đầy đủ ở {@code CashWalletService}.
     */
    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    /** Số dư ví NGAY SAU bút toán này. Cho phép dò lại lịch sử mà không cộng dồn. */
    @Column(name = "balance_after", nullable = false)
    private Long balanceAfter;

    /** Chỉ có ở bút toán CONVERT: số điểm đã phát cho người dùng. */
    @Column(name = "points_granted")
    private Integer pointsGranted;

    /** Chỉ có ở bút toán CONVERT: số đồng đổi 1 điểm tại thời điểm quy đổi. */
    @Column(name = "rate_snapshot")
    private Long rateSnapshot;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    /** Ai gây ra bút toán. Null với bút toán do hệ thống tự sinh (webhook). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
