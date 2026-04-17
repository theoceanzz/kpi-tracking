package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    Optional<KpiCriteria> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<KpiCriteria> findByCompanyId(UUID companyId, Pageable pageable);

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

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.company.id = :companyId AND k.status = :status AND " +
           "(k.assignedTo.id = :userId OR (k.assignedTo IS NULL AND k.department.id IN " +
           "(SELECT dm.department.id FROM DepartmentMember dm WHERE dm.user.id = :userId)))")
    long countMyAssignedKpis(@Param("companyId") UUID companyId,
                             @Param("status") KpiStatus status,
                             @Param("userId") UUID userId);

    long countByCompanyId(UUID companyId);

    long countByCompanyIdAndStatus(UUID companyId, KpiStatus status);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.company.id = :companyId AND k.department.id = :departmentId")
    long countByCompanyIdAndDepartmentId(@Param("companyId") UUID companyId,
                                         @Param("departmentId") UUID departmentId);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.company.id = :companyId " +
           "AND k.department.id = :departmentId AND k.status = :status")
    long countByCompanyIdAndDepartmentIdAndStatus(@Param("companyId") UUID companyId,
                                                   @Param("departmentId") UUID departmentId,
                                                   @Param("status") KpiStatus status);
}
