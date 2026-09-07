package com.kpitracking.repository;

import com.kpitracking.entity.TopupOrder;
import com.kpitracking.enums.TopupOrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TopupOrderRepository extends JpaRepository<TopupOrder, UUID> {

    Optional<TopupOrder> findByCode(String code);

    boolean existsByCode(String code);

    /**
     * Khoá dòng đơn trước khi đổi trạng thái. Bắt buộc ở CẢ đường ghi có của
     * webhook lẫn đường huỷ đơn của người dùng: không có khoá thì lệnh huỷ có thể
     * ghi đè {@code CANCELLED} lên đơn vừa được webhook chuyển sang {@code PAID},
     * để lại đơn "đã huỷ" trong khi tiền đã vào ví.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM TopupOrder o WHERE o.id = :id")
    Optional<TopupOrder> findByIdForUpdate(@Param("id") UUID id);

    Page<TopupOrder> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
            UUID organizationId, UUID userId, Pageable pageable);

    long countByOrganizationIdAndUserIdAndStatus(
            UUID organizationId, UUID userId, TopupOrderStatus status);

    /**
     * Hết hạn hàng loạt bằng MỘT câu UPDATE có điều kiện, không load-rồi-ghi.
     * Điều kiện {@code status = PENDING} nằm ngay trong WHERE nên đơn vừa được
     * webhook chuyển sang PAID sẽ không khớp và không bị đụng tới.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE TopupOrder o
               SET o.status = com.kpitracking.enums.TopupOrderStatus.EXPIRED,
                   o.updatedAt = :now
             WHERE o.status = com.kpitracking.enums.TopupOrderStatus.PENDING
               AND o.expiresAt < :now
            """)
    int expireOverdue(@Param("now") Instant now);
}
