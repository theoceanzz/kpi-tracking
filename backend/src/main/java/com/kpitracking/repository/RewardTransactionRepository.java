package com.kpitracking.repository;

import com.kpitracking.entity.RewardTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardTransactionRepository extends JpaRepository<RewardTransaction, UUID> {

    /**
     * Tra giao dịch theo khoá chống trùng. Khi gặp lỗi vi phạm ràng buộc duy nhất,
     * service dùng hàm này để trả lại chính giao dịch đã ghi (lần gọi lặp là no-op),
     * thay vì báo lỗi — retry mạng bình thường không nên hiện thành lỗi đỏ cho người dùng.
     */
    Optional<RewardTransaction> findByIdempotencyKey(String idempotencyKey);

    Page<RewardTransaction> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
            UUID userId, UUID organizationId, Pageable pageable);

    Page<RewardTransaction> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    /**
     * Những lần được thưởng gần nhất của cả tổ chức, cho bảng tin điểm thưởng.
     *
     * <p>Lọc rất hẹp là CHỦ Ý. Chỉ {@code EARN} nên hoàn điểm và điều chỉnh âm không lọt
     * vào; chỉ hai nguồn thưởng nên điểm danh ({@code CHECKIN}) không nhấn chìm bảng tin
     * và điều chỉnh tay của quản trị viên ({@code SYSTEM}) không bị đem đi khoe.
     *
     * <p>{@code JOIN FETCH} người nhận và người trao vì bảng tin hiện tên kèm ảnh đại
     * diện của cả hai — để lazy thì mỗi dòng là hai truy vấn phụ.
     */
    @Query("""
            SELECT t FROM RewardTransaction t
              JOIN FETCH t.user
              LEFT JOIN FETCH t.actor
             WHERE t.organization.id = :orgId
               AND t.type = com.kpitracking.enums.RewardTransactionType.EARN
               AND t.sourceType IN (com.kpitracking.enums.RewardSourceType.MANUAL_GRANT,
                                    com.kpitracking.enums.RewardSourceType.AUTO_RANKING)
             ORDER BY t.createdAt DESC
            """)
    List<RewardTransaction> findRecentAwardsForFeed(@Param("orgId") UUID orgId, Pageable pageable);

    List<RewardTransaction> findBySourceRefId(UUID sourceRefId);

    /**
     * Tổng điểm ĐƯỢC THƯỞNG theo từng người trong một khoảng thời gian.
     *
     * <p>Tổng hợp ở tầng DB thay vì kéo giao dịch về rồi cộng ở Java: bảng tin điểm thưởng
     * bị chặn ở 50 bản ghi gần nhất, nên cộng từ đó sẽ ra số sai khi tổ chức thưởng nhiều.
     *
     * <p>Chỉ tính {@code EARN} — hoàn điểm và điều chỉnh âm không phải "được thưởng".
     */
    @Query("""
            SELECT t.user.id, t.user.fullName, t.user.avatarUrl, SUM(t.amount)
              FROM RewardTransaction t
             WHERE t.organization.id = :orgId
               AND t.type = com.kpitracking.enums.RewardTransactionType.EARN
               AND (:from IS NULL OR t.createdAt >= :from)
               AND (:to IS NULL OR t.createdAt < :to)
             GROUP BY t.user.id, t.user.fullName, t.user.avatarUrl
             ORDER BY SUM(t.amount) DESC
            """)
    List<Object[]> sumEarnedByUser(@Param("orgId") UUID orgId,
                                   @Param("from") java.time.Instant from,
                                   @Param("to") java.time.Instant to,
                                   Pageable pageable);

    /**
     * Tổng điểm phát ra và tiêu đi theo từng tháng.
     *
     * <p>Trả về (năm, tháng, tổng EARN, tổng SPEND). Dùng CASE thay vì hai truy vấn để
     * tháng nào chỉ có một chiều vẫn ra đúng một dòng, không phải ghép ở Java.
     */
    @Query("""
            SELECT YEAR(t.createdAt), MONTH(t.createdAt),
                   SUM(CASE WHEN t.type = com.kpitracking.enums.RewardTransactionType.EARN
                            THEN t.amount ELSE 0 END),
                   SUM(CASE WHEN t.type = com.kpitracking.enums.RewardTransactionType.SPEND
                            THEN t.amount ELSE 0 END)
              FROM RewardTransaction t
             WHERE t.organization.id = :orgId
               AND t.createdAt >= :from
             GROUP BY YEAR(t.createdAt), MONTH(t.createdAt)
             ORDER BY YEAR(t.createdAt), MONTH(t.createdAt)
            """)
    List<Object[]> sumByMonth(@Param("orgId") UUID orgId, @Param("from") java.time.Instant from);
}
