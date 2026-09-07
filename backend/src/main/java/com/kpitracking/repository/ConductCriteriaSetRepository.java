package com.kpitracking.repository;

import com.kpitracking.entity.ConductCriteriaSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConductCriteriaSetRepository extends JpaRepository<ConductCriteriaSet, UUID> {

    /** Bộ mặc định đứng trước, còn lại theo thứ tự tạo — cùng thứ tự mà giao diện liệt kê. */
    List<ConductCriteriaSet> findByOrganizationIdOrderByIsDefaultDescCreatedAtAsc(UUID organizationId);

    Optional<ConductCriteriaSet> findByOrganizationIdAndIsDefaultTrue(UUID organizationId);

    /**
     * Bộ đang giữ kỳ này. Bảng nối khoá chính trên kpi_cycle_id nên tối đa một kết quả.
     * Viết tay vì {@code kpiCycleIds} là {@code @ElementCollection}, không suy được từ tên method.
     */
    @Query("""
            SELECT s FROM ConductCriteriaSet s
            JOIN s.kpiCycleIds c
            WHERE s.organization.id = :organizationId AND c = :cycleId
            """)
    Optional<ConductCriteriaSet> findByCycle(@Param("organizationId") UUID organizationId,
                                             @Param("cycleId") UUID cycleId);
}
