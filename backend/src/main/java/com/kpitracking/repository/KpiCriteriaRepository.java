package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    Page<KpiCriteria> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<KpiCriteria> findByStatus(KpiStatus status, Pageable pageable);

<<<<<<< HEAD
    Page<KpiCriteria> findByCompanyIdAndAssignedToId(UUID companyId, UUID assignedToId, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndStatus(UUID companyId, KpiStatus status, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndStatusAndDepartmentIdIn(UUID companyId, KpiStatus status, java.util.Collection<UUID> departmentIds, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndDepartmentId(UUID companyId, UUID departmentId, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndDepartmentIdIn(UUID companyId, java.util.Collection<UUID> departmentIds, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndCreatedById(UUID companyId, UUID createdById, Pageable pageable);

    Page<KpiCriteria> findByCompanyIdAndStatusAndCreatedById(UUID companyId, KpiStatus status, UUID createdById, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.company.id = :companyId AND k.status = :status AND " +
           "(k.assignedTo.id = :userId OR (k.assignedTo IS NULL AND k.department.id IN " +
           "(SELECT dm.department.id FROM DepartmentMember dm WHERE dm.user.id = :userId)))")
    Page<KpiCriteria> findMyKpis(@Param("companyId") UUID companyId,
                                 @Param("userId") UUID userId,
                                 @Param("status") KpiStatus status,
                                 Pageable pageable);
=======
    Page<KpiCriteria> findByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status, Pageable pageable);

    Page<KpiCriteria> findByAssignedToIdOrCreatedById(UUID assignedToId, UUID createdById, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    long countByAssignedToIdAndStatus(UUID assignedToId, KpiStatus status);
}
