package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Ví điểm thưởng của một nhân viên trong một tổ chức.
 *
 * <p>Đây chỉ là bản materialize để đọc nhanh — sự thật nằm ở sổ cái
 * {@link RewardTransaction}. Hai bất biến phải luôn đúng:
 * <pre>
 *   balance = SUM(reward_transactions.amount)
 *   balance = lifetimeEarned - lifetimeSpent - lifetimeExpired
 * </pre>
 *
 * <p>Ba cột tổng cố ý KHÔNG có setter công khai: điểm là thứ giống tiền, chỉ
 * {@code RewardWalletService.applyTransaction} được phép đổi, và nó đi qua
 * {@link #applyDelta} sau khi đã khoá dòng bằng {@code SELECT ... FOR UPDATE}.
 * Nếu để setter mở thì bất kỳ chỗ nào cũng ghi được và bất biến trên sẽ vỡ
 * mà không ai biết.
 *
 * <p>{@code balance} được phép ÂM: thu hồi thưởng sau khi người nhận đã tiêu điểm
 * phải trừ đủ, kẹp về 0 sẽ phá bất biến {@code balanceAfter = trước + amount}
 * của sổ cái. Việc chặn âm chỉ áp ở đường tiêu điểm (đổi quà).
 */
@Entity
@Table(name = "reward_wallets")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Setter(AccessLevel.NONE)
    @Column(name = "balance", nullable = false)
    @Builder.Default
    private Integer balance = 0;

    /** Tổng điểm đã nhận. Bị TRỪ NGƯỢC khi thưởng bị thu hồi (khoản đó coi như huỷ bỏ). */
    @Setter(AccessLevel.NONE)
    @Column(name = "lifetime_earned", nullable = false)
    @Builder.Default
    private Integer lifetimeEarned = 0;

    /** Tổng điểm đã tiêu. Bị TRỪ NGƯỢC khi đổi quà bị từ chối/huỷ (hoàn không phải nhận thêm). */
    @Setter(AccessLevel.NONE)
    @Column(name = "lifetime_spent", nullable = false)
    @Builder.Default
    private Integer lifetimeSpent = 0;

    /** Tổng điểm hết hạn. Chưa dùng ở v1, có sẵn để bật lên không phải sửa công thức. */
    @Setter(AccessLevel.NONE)
    @Column(name = "lifetime_expired", nullable = false)
    @Builder.Default
    private Integer lifetimeExpired = 0;

    /** Mã ví ở hệ thống ngoài. Chừa sẵn cho tích hợp ví điện tử, chưa dùng ở v1. */
    @Column(name = "external_wallet_ref")
    private String externalWalletRef;

    /**
     * Lưới an toàn PHỤ, bắt trường hợp ghi từ entity đã detached.
     * Cơ chế chính chống đua ghi là khoá bi quan trên dòng ví, không phải cột này —
     * khoá lạc quan trên một dòng chắc chắn bị tranh chấp chỉ đẩy mọi caller vào vòng retry.
     */
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private Long version = 0L;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * Cửa DUY NHẤT để đổi số dư — bốn cột trên không có setter nên đây là lối vào
     * duy nhất. Chỉ {@code RewardWalletService.applyTransaction} được gọi, và chỉ
     * sau khi đã khoá dòng ví bằng {@code SELECT ... FOR UPDATE}. Không service nào
     * khác được gọi hàm này.
     *
     * @param deltaBalance    thay đổi số dư (có dấu)
     * @param deltaEarned     thay đổi tổng đã nhận
     * @param deltaSpent      thay đổi tổng đã tiêu
     * @param deltaExpired    thay đổi tổng hết hạn
     */
    public void applyDelta(int deltaBalance, int deltaEarned, int deltaSpent, int deltaExpired) {
        this.balance += deltaBalance;
        this.lifetimeEarned += deltaEarned;
        this.lifetimeSpent += deltaSpent;
        this.lifetimeExpired += deltaExpired;
    }
}
