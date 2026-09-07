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
     * Những giấy khen một người ĐÃ THỰC SỰ được trao — nguồn của "Chứng nhận của tôi".
     *
     * <p>Hai điều kiện lọc, mỗi cái đóng một lỗ khác nhau:
     * <ul>
     *   <li>{@code APPROVED} — đề nghị đang chờ duyệt thì chưa phát điểm, bản đã thu hồi
     *       thì phần thưởng đã bị lấy lại. In giấy khen cho hai trạng thái đó là khen một
     *       việc chưa được công nhận, hoặc đã bị rút lại.</li>
     *   <li>{@code certificateEnabled} — người trao phải chủ động kèm giấy khen. Bỏ điều
     *       kiện này thì mọi lượt thưởng vặt đều thành một tờ "Cống hiến xuất sắc".</li>
     * </ul>
     *
     * <p>Sắp theo {@code approvedAt} chứ không phải {@code createdAt}: cái người nhận nhớ
     * là ngày được trao, không phải ngày sếp gõ đề nghị.
     */
    @Query("""
            SELECT g FROM RewardGrant g JOIN g.items i
             WHERE g.organization.id = :orgId
               AND i.user.id = :userId
               AND g.status = com.kpitracking.enums.RewardGrantStatus.APPROVED
               AND g.certificateEnabled = true
             ORDER BY g.approvedAt DESC, g.createdAt DESC
            """)
    Page<RewardGrant> findApprovedForRecipient(@Param("orgId") UUID orgId,
                                               @Param("userId") UUID userId,
                                               Pageable pageable);

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
