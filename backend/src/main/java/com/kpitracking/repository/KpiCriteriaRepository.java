package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.List;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a JOIN FETCH k.kpiPeriod WHERE " +
           "(EXISTS (SELECT 1 FROM OrgUnit au WHERE k.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:createdById IS NULL OR k.createdBy.id = :createdById) AND " +
           "(:orgUnitId IS NULL OR k.orgUnit.id = :orgUnitId) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND " +
           "(:keyword IS NULL OR :keyword = '' " +
           "OR LOWER(CAST(k.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(k.orgUnit.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.employeeCode AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) AND " +
           "(:currentUserRank IS NULL OR :currentUserRank = 0 OR k.createdBy.id = :currentUserId OR EXISTS (SELECT 1 FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.user.id = k.createdBy.id AND uro.orgUnit.id = k.orgUnit.id AND r.rank > :currentUserRank))")
    Page<KpiCriteria> findAllWithFilters(
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("createdById") UUID createdById,
            @Param("orgUnitId") UUID orgUnitId,
            @Param("status") KpiStatus status,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("keyword") String keyword,
            @Param("currentUserId") UUID currentUserId,
            @Param("currentUserRank") Integer currentUserRank,
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

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssignees(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodId(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    long countByOrgUnitIdIn(java.util.Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(java.util.Collection<UUID> orgUnitIds, KpiStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE k.orgUnit.id = :orgUnitId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(@org.springframework.data.repository.query.Param("orgUnitId") UUID orgUnitId, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses);
    
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE (:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitPathAndKpiPeriodIdAndStatusIn(@org.springframework.data.repository.query.Param("orgUnitPath") String orgUnitPath, @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    long countByAssigneeAndStatusIn(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("statuses") java.util.List<KpiStatus> statuses);

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
    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT k.orgUnit.id) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.orgUnit.parent IS NOT NULL")
    long countDistinctOrgUnitsWithKpiIn(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);
    // ===== Analytics queries =====

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.createdAt >= :from AND k.createdAt <= :to")
    List<KpiCriteria> findApprovedByAssigneeIdAndPeriod(@Param("userId") UUID userId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@Param("orgUnitIds") List<UUID> orgUnitIds);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    long countByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    long countByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    List<KpiCriteria> findByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);
}
