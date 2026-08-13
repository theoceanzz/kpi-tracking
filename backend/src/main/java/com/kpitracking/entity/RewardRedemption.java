package com.kpitracking.entity;

import com.kpitracking.enums.RedemptionStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một yêu cầu dùng điểm để đổi quà.
 *
 * <p>Điểm bị trừ và tồn kho bị giữ NGAY khi tạo yêu cầu, không phải khi được duyệt.
 * Nếu chỉ giữ chỗ mềm thì một người có 100 điểm có thể đặt năm yêu cầu 100 điểm cùng
 * lúc rồi được duyệt hết. Từ chối hoặc huỷ sẽ hoàn cả điểm lẫn tồn kho.
 */
@Entity
@Table(name = "reward_redemptions")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardRedemption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gift_item_id", nullable = false)
    private RewardGiftItem giftItem;

    /**
     * Tên quà chụp lại lúc đổi. Quà đổi tên hoặc đổi giá về sau không được phép làm
     * sai lịch sử của người đã đổi.
     */
    @Column(name = "gift_name_snapshot", nullable = false)
    private String giftNameSnapshot;

    /**
     * Ảnh quà chụp lại lúc đổi. Phải chụp cùng lúc với tên, nếu không lịch sử sẽ hiện
     * tên cũ kèm ảnh mới khi người quản lý thay ảnh cho món quà đó.
     */
    @Column(name = "gift_image_snapshot", columnDefinition = "TEXT")
    private String giftImageSnapshot;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "points_spent", nullable = false)
    private Integer pointsSpent;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private RedemptionStatus status = RedemptionStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handled_by")
    private User handledBy;

    @Column(name = "handled_at")
    private Instant handledAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    /** Giao dịch SPEND lúc đặt. */
    @Column(name = "transaction_id")
    private UUID transactionId;

    /** Giao dịch REFUND khi bị từ chối/huỷ. Null nếu chưa hoàn. */
    @Column(name = "refund_transaction_id")
    private UUID refundTransactionId;

    /** Chừa sẵn cho hệ thống giao quà ngoài. Chưa dùng ở v1. */
    @Column(name = "external_order_id")
    private String externalOrderId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fulfillment_payload", columnDefinition = "jsonb")
    private String fulfillmentPayload;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;
}
