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
 * Ví tiền thật của một nhân viên trong một tổ chức. Số dư tính bằng ĐỒNG.
 *
 * <p>Đây chỉ là bản materialize để đọc nhanh — sự thật nằm ở sổ cái
 * {@link CashTransaction}. Hai bất biến phải luôn đúng:
 * <pre>
 *   balance = SUM(cash_transactions.amount)
 *   balance = lifetimeTopup - lifetimeConverted
 * </pre>
 *
 * <p>Ba cột tổng cố ý KHÔNG có setter công khai: chỉ
 * {@code CashWalletService.applyTransaction} được phép đổi, và nó đi qua
 * {@link #applyDelta} sau khi đã khoá dòng bằng {@code SELECT ... FOR UPDATE}.
 * Nếu để setter mở thì bất kỳ chỗ nào cũng ghi được và bất biến trên sẽ vỡ mà
 * không ai biết.
 *
 * <p><b>Khác {@link RewardWallet}: {@code balance} KHÔNG được phép âm.</b> Ví điểm
 * cho phép âm vì có đường thu hồi thưởng sau khi người nhận đã tiêu; ví tiền
 * không có đường nào tương tự nên mọi lối ra đều kiểm số dư trước khi ghi, và DB
 * có {@code CHECK (balance >= 0)} làm lưới cuối.
 *
 * <p>Tiền dùng {@code Long} đồng chứ không phải {@code BigDecimal}: VND không có
 * đơn vị nhỏ hơn đồng nên số nguyên là biểu diễn chính xác tuyệt đối, không sai
 * số làm tròn và không cần chính sách rounding ở bất kỳ đâu.
 */
@Entity
@Table(name = "cash_wallets")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CashWallet {

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
    private Long balance = 0L;

    /** Tổng tiền đã nạp. Bị TRỪ NGƯỢC khi một khoản nạp bị điều chỉnh huỷ bỏ. */
    @Setter(AccessLevel.NONE)
    @Column(name = "lifetime_topup", nullable = false)
    @Builder.Default
    private Long lifetimeTopup = 0L;

    /** Tổng tiền đã quy đổi sang điểm. */
    @Setter(AccessLevel.NONE)
    @Column(name = "lifetime_converted", nullable = false)
    @Builder.Default
    private Long lifetimeConverted = 0L;

    /**
     * Lưới an toàn PHỤ, bắt trường hợp ghi từ entity đã detached. Cơ chế chính
     * chống đua ghi là khoá bi quan trên dòng ví, không phải cột này.
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
     * Cửa DUY NHẤT để đổi số dư — ba cột trên không có setter nên đây là lối vào
     * duy nhất. Chỉ {@code CashWalletService.applyTransaction} được gọi, và chỉ
     * sau khi đã khoá dòng ví bằng {@code SELECT ... FOR UPDATE}. Không service
     * nào khác được gọi hàm này.
     *
     * @param deltaBalance   thay đổi số dư (có dấu)
     * @param deltaTopup     thay đổi tổng đã nạp
     * @param deltaConverted thay đổi tổng đã quy đổi
     */
    public void applyDelta(long deltaBalance, long deltaTopup, long deltaConverted) {
        this.balance += deltaBalance;
        this.lifetimeTopup += deltaTopup;
        this.lifetimeConverted += deltaConverted;
    }
}
