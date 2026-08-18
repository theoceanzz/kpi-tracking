package com.kpitracking.repository;

import com.kpitracking.entity.RewardRedemption;
import com.kpitracking.enums.RedemptionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardRedemptionRepository extends JpaRepository<RewardRedemption, UUID> {

    Page<RewardRedemption> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
            UUID userId, UUID organizationId, Pageable pageable);

    @Query("""
            SELECT r FROM RewardRedemption r
             WHERE r.organization.id = :orgId
               AND (:status IS NULL OR r.status = :status)
             ORDER BY r.createdAt DESC
            """)
    Page<RewardRedemption> search(@Param("orgId") UUID orgId,
                                  @Param("status") RedemptionStatus status,
                                  Pageable pageable);

    /**
     * Những lần đổi quà gần nhất, cho bảng tin điểm thưởng.
     *
     * <p>Bỏ các trạng thái đã hoàn điểm (từ chối, tự huỷ, nhà cung cấp hỏng): người xem
     * sẽ thấy "A vừa đổi voucher" rồi mai không thấy A cầm voucher nào — dòng tin đó
     * chưa bao giờ thành sự thật nên không nên loan báo.
     */
    @Query("""
            SELECT r FROM RewardRedemption r
              JOIN FETCH r.user
             WHERE r.organization.id = :orgId
               AND r.status NOT IN (com.kpitracking.enums.RedemptionStatus.REJECTED,
                                    com.kpitracking.enums.RedemptionStatus.CANCELLED,
                                    com.kpitracking.enums.RedemptionStatus.FAILED)
             ORDER BY r.createdAt DESC
            """)
    List<RewardRedemption> findRecentForFeed(@Param("orgId") UUID orgId, Pageable pageable);

    long countByOrganizationIdAndStatus(UUID organizationId, RedemptionStatus status);

    /**
     * Còn yêu cầu nào trỏ về món quà này không — dùng để CHẶN xoá.
     *
     * <p>Quà bị xoá mềm sẽ biến mất khỏi mọi truy vấn ({@code @SQLRestriction}), nên
     * yêu cầu đổi cũ trỏ về nó sẽ ném lỗi khi nạp. Ràng buộc khoá ngoại của bảng cũng
     * đặt {@code ON DELETE RESTRICT} với cùng ý đồ.
     */
    long countByGiftItemId(UUID giftItemId);

    long countByGiftItemIdAndStatus(UUID giftItemId, RedemptionStatus status);

    /**
     * Số yêu cầu ĐANG CHỜ theo từng món quà, lấy một lần cho cả danh sách quản trị
     * thay vì đếm lẻ từng món.
     *
     * <p>Trả về {@code [giftItemId, count]}.
     */
    @Query("""
            SELECT r.giftItem.id, COUNT(r) FROM RewardRedemption r
             WHERE r.organization.id = :orgId
               AND r.status = com.kpitracking.enums.RedemptionStatus.PENDING
             GROUP BY r.giftItem.id
            """)
    List<Object[]> countPendingByGift(@Param("orgId") UUID orgId);
}
