package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.UUID;
import java.util.List;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    @Query("SELECT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod WHERE " +
           "(:isGlobalAdmin = true OR EXISTS (SELECT 1 FROM OrgUnit au WHERE k.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:createdById IS NULL OR k.createdBy.id = :createdById) AND " +
           "(:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId)")
    Page<KpiCriteria> findAllWithFilters(
            @Param("isGlobalAdmin") boolean isGlobalAdmin,
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("createdById") UUID createdById,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("status") KpiStatus status,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            Pageable pageable
    );

    Page<KpiCriteria> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<KpiCriteria> findByStatus(KpiStatus status, Pageable pageable);

    List<KpiCriteria> findByStatus(KpiStatus status);

    Page<KpiCriteria> findByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById")
    Page<KpiCriteria> findByCreatedById(@org.springframework.data.repository.query.Param("createdById") UUID createdById, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndStatus(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("status") KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitId(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitIdAndStatus(@org.springframework.data.repository.query.Param("createdById") UUID createdById, @org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, @org.springframework.data.repository.query.Param("status") KpiStatus status, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a WHERE a.id = :userId OR k.createdBy.id = :userId")
    Page<KpiCriteria> findByUserIdInAssigneesOrCreatedBy(@org.springframework.data.repository.query.Param("userId") UUID userId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    Page<KpiCriteria> findByUserIdInAssignees(@org.springframework.data.repository.query.Param("userId") UUID userId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodId(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    long countByOrgUnitIdIn(java.util.Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(java.util.Collection<UUID> orgUnitIds, KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE k.orgUnit.id = :orgUnitId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(@org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses);
    
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE (:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitPathAndKpiPeriodIdAndStatusIn(@org.springframework.data.repository.query.Param("orgUnitPath") String orgUnitPath, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = :status")
    long countByAssigneeAndStatus(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("status") KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId AND k.status = :status")
    long countByOrganizationIdAndStatus(@org.springframework.data.repository.query.Param("orgId") UUID orgId, @org.springframework.data.repository.query.Param("status") KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@org.springframework.data.repository.query.Param("path") String path);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path AND k.status = :status")
    long countByOrgUnitPathAndStatus(@org.springframework.data.repository.query.Param("path") String path, @org.springframework.data.repository.query.Param("status") KpiStatus status);
}
