package com.kpitracking.repository;

import com.kpitracking.entity.KpiApprovalStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiApprovalStepRepository extends JpaRepository<KpiApprovalStep, UUID> {

    /** Chỉ lấy id flow — để khoá flow TRƯỚC khi nạp trạng thái bước (tránh đọc bản cũ). */
    @Query("SELECT s.flow.id FROM KpiApprovalStep s WHERE s.id = :stepId")
    Optional<UUID> findFlowIdByStepId(@Param("stepId") UUID stepId);

    /**
     * Người này xem được KPI nhờ chuỗi duyệt (chuỗi duyệt KPI lẫn chuỗi điều chỉnh): đang giữ bước HIỆN TẠI (bước
     * PENDING), hoặc đã tự tay duyệt / từ chối một bước. Người giữ bước phía trên còn WAITING thì KHÔNG — cấp trên
     * chưa thấy KPI cho tới khi tới lượt mình (luật chuỗi duyệt).
     */
    @Query("SELECT COUNT(s) > 0 FROM KpiApprovalStep s LEFT JOIN s.approvers ap " +
           "WHERE s.flow.kpiCriteria.id = :kpiId AND (s.actedBy.id = :userId " +
           "  OR (s.status = com.kpitracking.enums.ApprovalStepStatus.PENDING AND ap.userId = :userId))")
    boolean isChainViewer(@Param("kpiId") UUID kpiId, @Param("userId") UUID userId);
}
