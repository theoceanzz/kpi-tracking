package com.kpitracking.repository.reward;

import com.kpitracking.entity.reward.RewardGrantItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface RewardGrantItemRepository extends JpaRepository<RewardGrantItem, UUID> {

    List<RewardGrantItem> findByGrantId(UUID grantId);

    List<RewardGrantItem> findByGrantIdIn(List<UUID> grantIds);

    /**
     * Lượt thưởng tay của một người CHƯA được ăn mừng: chỉ đề nghị đã duyệt VÀ đã phát điểm (có giao
     * dịch). Đề nghị chờ duyệt / bị từ chối / huỷ / thu hồi đều không lọt — thu hồi trước khi người nhận
     * kịp xem thì cũng thôi không ăn mừng. Không lọc người thưởng: người tự đứng tên trong danh sách
     * nhận vẫn được ăn mừng như mọi người nhận khác.
     */
    @Query("""
            SELECT i FROM RewardGrantItem i JOIN FETCH i.grant g JOIN FETCH g.grantor
             WHERE i.user.id = :userId
               AND i.celebratedAt IS NULL
               AND i.transactionId IS NOT NULL
               AND g.status = com.kpitracking.enums.reward.RewardGrantStatus.APPROVED
               AND g.deletedAt IS NULL
               AND g.organization.id = :orgId
               AND COALESCE(g.approvedAt, i.createdAt) >= :since
             ORDER BY COALESCE(g.approvedAt, i.createdAt)
            """)
    List<RewardGrantItem> findUncelebrated(@Param("userId") UUID userId, @Param("orgId") UUID orgId,
                                           @Param("since") Instant since, Pageable page);

    /** Đánh dấu đã ăn mừng — chỉ dòng của chính người đó, chỉ dòng còn trống (gọi lại không đổi gì). */
    @Modifying
    @Query("""
            UPDATE RewardGrantItem i SET i.celebratedAt = :now
             WHERE i.user.id = :userId AND i.grant.id IN :grantIds AND i.celebratedAt IS NULL
            """)
    int markCelebrated(@Param("userId") UUID userId, @Param("grantIds") Collection<UUID> grantIds,
                       @Param("now") Instant now);
}
