package com.kpitracking.entity;

import com.kpitracking.enums.GiftItemStatus;
import com.kpitracking.enums.GiftItemType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Một món quà trong cửa hàng đổi điểm của tổ chức.
 *
 * <p>{@link #stockQuantity} KHÔNG được sửa bằng đọc-rồi-ghi trong Java. Mọi thay đổi
 * tồn kho phải đi qua câu UPDATE có điều kiện trong {@code RewardGiftItemRepository}
 * rồi kiểm số dòng ảnh hưởng — nếu không, hai người đổi món cuối cùng cùng lúc sẽ
 * cùng thành công.
 */
@Entity
@Table(name = "reward_gift_items")
@EntityListeners(AuditingEntityListener.class)
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RewardGiftItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "point_cost", nullable = false)
    private Integer pointCost;

    /** Bỏ qua khi {@link #unlimitedStock} bật. Chỉ sửa qua UPDATE có điều kiện. */
    @Setter(AccessLevel.NONE)
    @Column(name = "stock_quantity", nullable = false)
    @Builder.Default
    private Integer stockQuantity = 0;

    @Column(name = "unlimited_stock", nullable = false)
    @Builder.Default
    private Boolean unlimitedStock = false;

    /**
     * Quà có cần người trao tận tay không.
     *
     * <p>{@code true} (mặc định): quà vật lý — yêu cầu đổi ở trạng thái chờ giao cho tới
     * khi có người đánh dấu đã trao.
     * <p>{@code false}: nhận ngay — yêu cầu tự hoàn tất lúc đặt, không ai phải bấm gì.
     */
    @Column(name = "requires_delivery", nullable = false)
    @Builder.Default
    private Boolean requiresDelivery = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    @Builder.Default
    private GiftItemType type = GiftItemType.INTERNAL;

    /** Chừa sẵn cho sàn quà tặng ngoài. Chưa dùng ở v1. */
    @Column(name = "external_provider", length = 50)
    private String externalProvider;

    @Column(name = "external_sku")
    private String externalSku;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private GiftItemStatus status = GiftItemStatus.ACTIVE;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    /**
     * Chỉ dùng khi người quản lý sửa tồn kho trên màn hình quản trị (đặt lại một con
     * số tuyệt đối). Luồng đổi quà KHÔNG dùng hàm này — nó đi qua UPDATE có điều kiện
     * ở repository để tránh đua ghi.
     */
    public void setStockByAdmin(Integer newStock) {
        this.stockQuantity = newStock == null ? 0 : Math.max(0, newStock);
    }
}
