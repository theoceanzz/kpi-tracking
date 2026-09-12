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
import java.util.List;
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
     * Điều kiện {@code status = 'PENDING'} nằm ngay trong WHERE nên đơn vừa được
     * webhook chuyển sang PAID sẽ không khớp và không bị đụng tới.
     *
     * <p>Trả về id của ĐÚNG những đơn vừa bị đổi, để bộ chạy nền báo cho từng chủ đơn.
     * Phải là {@code UPDATE ... RETURNING} chứ không phải "chọn trước rồi cập nhật":
     * chọn trước mở ra khe hở webhook trả tiền cho một đơn nằm trong danh sách vừa
     * chọn, và chủ đơn nhận thư "đơn đã hết hạn" cho khoản tiền đã vào ví. Một câu
     * lệnh thì tập trả về đúng bằng tập thực sự bị đổi.
     *
     * <p>Native vì JPQL không có {@code RETURNING}. Kéo theo là phải tự viết
     * {@code deleted_at IS NULL} — {@code @SQLRestriction} của entity chỉ áp cho
     * câu lệnh do Hibernate sinh.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE topup_orders
               SET status = 'EXPIRED', updated_at = :now
             WHERE status = 'PENDING'
               AND expires_at < :now
               AND deleted_at IS NULL
            RETURNING id
            """, nativeQuery = true)
    List<UUID> expireOverdue(@Param("now") Instant now);
}
