package com.kpitracking.repository;

import com.kpitracking.entity.KpiApprovalFlow;
import com.kpitracking.enums.ApprovalSubjectType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiApprovalFlowRepository extends JpaRepository<KpiApprovalFlow, UUID> {

    /**
     * Khoá hàng flow cho tới hết transaction. Hai người cùng bấm duyệt một KPI thì người sau chờ ở
     * đây, rồi thấy bước đã được xử lý và nhận 409 — không có chuyện cả hai cùng thành công.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT f FROM KpiApprovalFlow f WHERE f.id = :id")
    Optional<KpiApprovalFlow> lockById(@Param("id") UUID id);

    /** Chỉ id: để khoá hàng trước rồi mới nạp trạng thái (xem {@code KpiApprovalChainService#lockFlow}). */
    @Query("SELECT f.id FROM KpiApprovalFlow f WHERE f.kpiCriteria.id = :kpiId AND f.subjectType = :type " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS")
    Optional<UUID> findRunningId(@Param("kpiId") UUID kpiId, @Param("type") ApprovalSubjectType type);

    @Query("SELECT f.id FROM KpiApprovalFlow f WHERE f.adjustmentRequest.id = :adjustmentId " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS")
    Optional<UUID> findRunningIdByAdjustment(@Param("adjustmentId") UUID adjustmentId);

    @Query("SELECT f.id FROM KpiApprovalFlow f WHERE f.kpiCriteria.id IN :kpiIds " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS")
    List<UUID> findRunningIdsByKpiIds(@Param("kpiIds") Collection<UUID> kpiIds);

    /** Mọi flow đang chạy trên các KPI này, cả chỉ tiêu lẫn điều chỉnh. */
    @Query("SELECT f FROM KpiApprovalFlow f WHERE f.kpiCriteria.id IN :kpiIds " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS")
    List<KpiApprovalFlow> findRunningByKpiIds(@Param("kpiIds") Collection<UUID> kpiIds);

    @Query("SELECT f FROM KpiApprovalFlow f WHERE f.adjustmentRequest.id IN :ids " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS")
    List<KpiApprovalFlow> findRunningByAdjustmentIds(@Param("ids") Collection<UUID> ids);

    /** Lịch sử mọi lần gửi của một KPI (chỉ tiêu + điều chỉnh), mới nhất trước. */
    List<KpiApprovalFlow> findByKpiCriteriaIdOrderByStartedAtDesc(UUID kpiCriteriaId);

    List<KpiApprovalFlow> findByAdjustmentRequestIdOrderByStartedAtDesc(UUID adjustmentRequestId);

    long countByKpiCriteriaIdAndSubjectType(UUID kpiCriteriaId, ApprovalSubjectType subjectType);

    long countByAdjustmentRequestId(UUID adjustmentRequestId);

    /**
     * Hộp "chờ tôi duyệt": flow đang chạy mà BƯỚC HIỆN TẠI có người này trong nhóm giữ bước.
     * Bước chưa tới lượt (WAITING) không lọt vào — cấp trên chỉ thấy khi cấp dưới đã duyệt xong.
     */
    @Query("SELECT DISTINCT f FROM KpiApprovalFlow f JOIN f.steps s JOIN s.approvers a " +
           "WHERE f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS " +
           "AND s.stepOrder = f.currentStepOrder " +
           "AND s.status = com.kpitracking.enums.ApprovalStepStatus.PENDING " +
           "AND a.userId = :userId AND f.subjectType = :type")
    List<KpiApprovalFlow> findInbox(@Param("userId") UUID userId, @Param("type") ApprovalSubjectType type);

    @Query("SELECT COUNT(DISTINCT f.id) FROM KpiApprovalFlow f JOIN f.steps s JOIN s.approvers a " +
           "WHERE f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS " +
           "AND s.stepOrder = f.currentStepOrder " +
           "AND s.status = com.kpitracking.enums.ApprovalStepStatus.PENDING " +
           "AND a.userId = :userId AND f.subjectType = :type")
    long countInbox(@Param("userId") UUID userId, @Param("type") ApprovalSubjectType type);

    /** Flow đang chờ ở một bước có người này giữ — dùng khi tài khoản bị vô hiệu hoá. */
    @Query("SELECT DISTINCT f.id FROM KpiApprovalFlow f JOIN f.steps s JOIN s.approvers a " +
           "WHERE f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS " +
           "AND s.status = com.kpitracking.enums.ApprovalStepStatus.PENDING AND a.userId = :userId")
    List<UUID> findRunningIdsHeldBy(@Param("userId") UUID userId);

    /** Flow có bước đang chờ quá mốc — ứng viên nhắc việc. */
    @Query("SELECT DISTINCT f.id FROM KpiApprovalFlow f JOIN f.steps s " +
           "WHERE f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS " +
           "AND s.status = com.kpitracking.enums.ApprovalStepStatus.PENDING " +
           "AND s.pendingSince < :cutoff " +
           "AND (s.lastRemindedAt IS NULL OR s.lastRemindedAt < :cutoff)")
    List<UUID> findIdsWithStepPendingBefore(@Param("cutoff") java.time.Instant cutoff);

    /** KPI đang chờ duyệt theo luồng cũ (chưa có flow nào đang chạy) của một tổ chức — dùng khi chuyển đổi. */
    @Query("SELECT k.id FROM KpiCriteria k WHERE k.status = com.kpitracking.enums.KpiStatus.PENDING_APPROVAL " +
           "AND k.orgUnit.orgHierarchyLevel.organization.id = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM KpiApprovalFlow f WHERE f.kpiCriteria = k " +
           "AND f.subjectType = com.kpitracking.enums.ApprovalSubjectType.CRITERIA " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS)")
    List<UUID> findLegacyPendingCriteriaIds(@Param("orgId") UUID orgId);

    @Query("SELECT r.id FROM KpiAdjustmentRequest r WHERE r.status = com.kpitracking.enums.AdjustmentStatus.PENDING " +
           "AND r.kpiCriteria.orgUnit.orgHierarchyLevel.organization.id = :orgId " +
           "AND NOT EXISTS (SELECT 1 FROM KpiApprovalFlow f WHERE f.adjustmentRequest = r " +
           "AND f.status = com.kpitracking.enums.ApprovalFlowStatus.IN_PROGRESS)")
    List<UUID> findLegacyPendingAdjustmentIds(@Param("orgId") UUID orgId);
}
