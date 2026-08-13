package com.kpitracking.repository;

import com.kpitracking.entity.RewardGrant;
import com.kpitracking.enums.RewardGrantStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface RewardGrantRepository extends JpaRepository<RewardGrant, UUID> {

    /**
     * Hạn mức ĐÃ DÙNG của một ngân sách — suy ra, không đọc từ cột đếm.
     *
     * <p>Đề nghị đang chờ duyệt CŨNG giữ chỗ hạn mức, nếu không một người có thể tạo
     * nhiều đề nghị chờ duyệt để lách.
     *
     * <p>Vì tính bằng tổng nên REJECTED/CANCELLED/REVOKED tự rơi ra khỏi kết quả —
     * hạn mức được trả lại mà không cần viết một dòng logic hoàn trả nào.
     */
    @Query("""
            SELECT COALESCE(SUM(g.totalPoints), 0) FROM RewardGrant g
             WHERE g.budget.id = :budgetId
               AND g.status IN (com.kpitracking.enums.RewardGrantStatus.PENDING_APPROVAL,
                                com.kpitracking.enums.RewardGrantStatus.APPROVED)
            """)
    int sumUsedPointsByBudgetId(@Param("budgetId") UUID budgetId);

    @Query("""
            SELECT g FROM RewardGrant g
             WHERE g.organization.id = :orgId
               AND (:status IS NULL OR g.status = :status)
               AND (:grantorId IS NULL OR g.grantor.id = :grantorId)
               AND (:orgUnitIds IS NULL OR g.orgUnit.id IN :orgUnitIds)
             ORDER BY g.createdAt DESC
            """)
    Page<RewardGrant> search(@Param("orgId") UUID orgId,
                             @Param("status") RewardGrantStatus status,
                             @Param("grantorId") UUID grantorId,
                             @Param("orgUnitIds") Collection<UUID> orgUnitIds,
                             Pageable pageable);

    List<RewardGrant> findByOrganizationIdAndStatus(UUID organizationId, RewardGrantStatus status);

    /**
     * Có đề nghị nào từng tính vào hạn mức này không — dùng để CHẶN xoá.
     *
     * <p>Khác {@link #sumUsedPointsByBudgetId}: hàm kia chỉ đếm đề nghị đang chờ và đã
     * duyệt, còn hàm này đếm cả những đề nghị bị từ chối/huỷ. Xoá hạn mức sẽ làm mọi
     * đề nghị đó mất điểm neo, và nếu cấp lại hạn mức mới thì phần đã tiêu cũ biến mất
     * khỏi phép tính — người quản lý được reset quota một cách âm thầm.
     */
    long countByBudgetId(UUID budgetId);
}
