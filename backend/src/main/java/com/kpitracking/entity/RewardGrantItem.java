package com.kpitracking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một người nhận trong đề nghị thưởng, kèm số điểm dành cho người đó.
 *
 * <p>Chỉ ghi thêm, không soft-delete: sửa danh sách người nhận sau khi đã gửi không
 * phải là thao tác hợp lệ — huỷ đề nghị rồi tạo lại mới đúng.
 *
 * <p>{@code UNIQUE (grant_id, user_id)} ở DB chỉ là lưới an toàn cuối. Việc kiểm
 * trùng người nhận phải làm ở tầng request với thông báo rõ ràng, không để lỗi rơi
 * xuống thành ràng buộc DB khó hiểu.
 */
@Entity
@Table(name = "reward_grant_items")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardGrantItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grant_id", nullable = false)
    private RewardGrant grant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "points", nullable = false)
    private Integer points;

    /** Giao dịch sổ cái sinh ra khi phát điểm. Null khi đề nghị còn đang chờ duyệt. */
    @Column(name = "transaction_id")
    private UUID transactionId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
