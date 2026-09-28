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
}
