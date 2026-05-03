package com.kpitracking.repository;

import com.kpitracking.entity.KpiAdjustmentRequest;
import com.kpitracking.enums.AdjustmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface KpiAdjustmentRequestRepository extends JpaRepository<KpiAdjustmentRequest, UUID> {
    
    Page<KpiAdjustmentRequest> findByRequesterId(UUID requesterId, Pageable pageable);
    
    @Query("SELECT r FROM KpiAdjustmentRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:orgUnitId IS NULL OR r.kpiCriteria.orgUnit.id = :orgUnitId) " +
           "AND (:kpiPeriodId IS NULL OR r.kpiCriteria.kpiPeriod.id = :kpiPeriodId)")
    Page<KpiAdjustmentRequest> findAllWithFilters(
            @Param("status") AdjustmentStatus status,
            @Param("orgUnitId") UUID orgUnitId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            Pageable pageable);
}
