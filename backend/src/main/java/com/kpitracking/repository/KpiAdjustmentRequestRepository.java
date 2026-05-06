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
           "WHERE (r.requester.id = :currentUserId OR EXISTS (SELECT 1 FROM OrgUnit au WHERE r.kpiCriteria.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) " +
           "AND (:status IS NULL OR r.status = :status) " +
           "AND (:orgUnitPath IS NULL OR r.kpiCriteria.orgUnit.path LIKE :orgUnitPath) " +
           "AND (:kpiPeriodId IS NULL OR r.kpiCriteria.kpiPeriod.id = :kpiPeriodId) " +
           "AND (:currentUserRank IS NULL OR :currentUserRank = 0 OR r.requester.id = :currentUserId OR EXISTS (SELECT 1 FROM UserRoleOrgUnit uro JOIN uro.role r2 WHERE uro.user.id = r.requester.id AND uro.orgUnit.id = r.kpiCriteria.orgUnit.id AND r2.rank > :currentUserRank))")
    Page<KpiAdjustmentRequest> findAllWithFilters(
            @Param("currentUserId") UUID currentUserId,
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("status") AdjustmentStatus status,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("currentUserRank") Integer currentUserRank,
            Pageable pageable);

    java.util.List<KpiAdjustmentRequest> findByStatusAndCreatedAtBefore(AdjustmentStatus status, java.time.Instant expiryTime);
}
