package com.kpitracking.entity;

import com.kpitracking.enums.RewardSourceType;
import com.kpitracking.enums.RewardTransactionType;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một dòng sổ cái điểm thưởng.
 *
 * <p>Bảng CHỈ GHI THÊM — không {@code updated_at}, không {@code deleted_at}, không
 * {@code @SQLRestriction} (theo đúng tiền lệ {@link CycleUnitEvalEvent}). Sửa sai
 * nghĩa là ghi một giao dịch bù trừ mới trỏ về giao dịch cũ qua
 * {@link #reversalOfTransactionId}, không bao giờ sửa hay xoá dòng đã ghi.
 *
 * <p>Chỉ {@code RewardWalletService.applyTransaction} được phép tạo bản ghi ở đây.
 */
@Entity
@Table(name = "reward_transactions")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private RewardWallet wallet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Có dấu: EARN/REFUND/ADJUST(+) dương, SPEND/EXPIRE/ADJUST(-) âm. Không bao giờ bằng 0. */
    @Column(name = "amount", nullable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private RewardTransactionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 20)
    private RewardSourceType sourceType;

    /** Id bản ghi nghiệp vụ sinh ra giao dịch: grant item / run item / redemption. */
    @Column(name = "source_ref_id")
    private UUID sourceRefId;

    /** Giao dịch bị bù trừ, với REFUND (hoàn đổi quà) và ADJUST âm (thu hồi thưởng). */
    @Column(name = "reversal_of_transaction_id")
    private UUID reversalOfTransactionId;

    /** HRM | EWALLET | MARKETPLACE. Chừa sẵn cho tích hợp ngoài, chưa dùng ở v1. */
    @Column(name = "external_system", length = 50)
    private String externalSystem;

    @Column(name = "external_ref")
    private String externalRef;

    /**
     * Chống ghi trùng khi retry mạng hoặc bấm hai lần. Bắt buộc có (NOT NULL) để ép
     * mọi luồng mới phải nghĩ ra khoá thay vì lặng lẽ bỏ trống và mất lớp bảo vệ.
     * Xem bảng đăng ký khoá đầy đủ ở {@code RewardWalletService}.
     */
    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    /** Số dư ví NGAY SAU giao dịch này. Cho phép dò lại lịch sử mà không phải cộng dồn. */
    @Column(name = "balance_after", nullable = false)
    private Integer balanceAfter;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    /** Ai gây ra giao dịch. Null với giao dịch do hệ thống tự sinh. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
