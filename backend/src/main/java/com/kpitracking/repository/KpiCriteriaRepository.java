package com.kpitracking.repository;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.KpiStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Collection;

@Repository
public interface KpiCriteriaRepository extends JpaRepository<KpiCriteria, UUID> {

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a JOIN FETCH k.kpiPeriod " +
           "LEFT JOIN FETCH k.keyResult kr LEFT JOIN FETCH kr.objective obj WHERE " +
           "(EXISTS (SELECT 1 FROM OrgUnit au WHERE k.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:createdById IS NULL OR k.createdBy.id = :createdById) AND " +
           "(:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND " +
           "(:keyword IS NULL OR :keyword = '' " +
           "OR LOWER(CAST(k.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(k.orgUnit.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(CAST(a.employeeCode AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND " +
           "(cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate) AND " +
           "(:objectiveId IS NULL OR k.keyResult.objective.id = :objectiveId) AND " +
           "(:keyResultId IS NULL OR k.keyResult.id = :keyResultId) AND " +
           "(:currentUserRank IS NULL OR :currentUserRank = 0 OR k.createdBy.id = :currentUserId OR " +
           "EXISTS (SELECT 1 FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.user.id = k.createdBy.id " +
           "AND (r.level > :currentUserLevel OR (uro.orgUnit.id = k.orgUnit.id AND r.rank > :currentUserRank))))")
    Page<KpiCriteria> findAllWithFilters(
            @Param("allowedOrgUnitIds") Collection<UUID> allowedOrgUnitIds,
            @Param("createdById") UUID createdById,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("status") KpiStatus status,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("keyword") String keyword,
            @Param("currentUserId") UUID currentUserId,
            @Param("currentUserRank") Integer currentUserRank,
            @Param("currentUserLevel") Integer currentUserLevel,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("objectiveId") UUID objectiveId,
            @Param("keyResultId") UUID keyResultId,
            Pageable pageable
    );

    Page<KpiCriteria> findByOrgUnitId(UUID orgUnitId, Pageable pageable);

    Page<KpiCriteria> findByStatus(KpiStatus status, Pageable pageable);

    List<KpiCriteria> findByStatus(KpiStatus status);

    Page<KpiCriteria> findByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById")
    Page<KpiCriteria> findByCreatedById(@Param("createdById") UUID createdById, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndStatus(@Param("createdById") UUID createdById, @Param("status") KpiStatus status, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitId(@Param("createdById") UUID createdById, @Param("orgUnitId") UUID orgUnitId, Pageable pageable);

    @Query("SELECT k FROM KpiCriteria k WHERE k.createdBy.id = :createdById AND k.orgUnit.id = :orgUnitId AND k.status = :status")
    Page<KpiCriteria> findByCreatedByIdAndOrgUnitIdAndStatus(@Param("createdById") UUID createdById, @Param("orgUnitId") UUID orgUnitId, @Param("status") KpiStatus status, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a WHERE a.id = :userId OR k.createdBy.id = :userId")
    Page<KpiCriteria> findByUserIdInAssigneesOrCreatedBy(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssignees(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND (cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate)")
    Page<KpiCriteria> findByUserIdInAssigneesWithDate(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses, 
                                                     @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodId(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses, Pageable pageable);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN FETCH k.kpiPeriod JOIN k.assignees a WHERE a.id = :userId AND k.kpiPeriod.id = :kpiPeriodId AND k.status IN :statuses AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND (cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate)")
    Page<KpiCriteria> findByUserIdInAssigneesAndKpiPeriodIdWithDate(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses, 
                                                                   @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, Pageable pageable);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, KpiStatus status);

    long countByStatus(KpiStatus status);

    long countByOrgUnitIdIn(Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(Collection<UUID> orgUnitIds, KpiStatus status);

    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE k.orgUnit.id = :orgUnitId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(@Param("orgUnitId") UUID orgUnitId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);
    
    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k WHERE (:orgUnitPath IS NULL OR k.orgUnit.path LIKE :orgUnitPath) AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByOrgUnitPathAndKpiPeriodIdAndStatusIn(@Param("orgUnitPath") String orgUnitPath, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status IN :statuses")
    long countByAssigneeAndStatusIn(@Param("userId") UUID userId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = :status")
    long countByAssigneeAndStatus(@Param("userId") UUID userId, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.orgHierarchyLevel.organization.id = :orgId AND k.status = :status")
    long countByOrganizationIdAndStatus(@Param("orgId") UUID orgId, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@Param("path") String path);

    @Query("SELECT COUNT(k) FROM KpiCriteria k WHERE k.orgUnit.path LIKE :path AND k.status = :status")
    long countByOrgUnitPathAndStatus(@Param("path") String path, @Param("status") KpiStatus status);

    @Query("SELECT COUNT(DISTINCT k.orgUnit.id) FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.orgUnit.parent IS NOT NULL")
    long countDistinctOrgUnitsWithKpiIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED'")
    List<KpiCriteria> findApprovedByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT k FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND k.status = 'APPROVED' AND k.createdAt >= :from AND k.createdAt <= :to")
    List<KpiCriteria> findApprovedByAssigneeIdAndPeriod(@Param("userId") UUID userId, @Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(DISTINCT k) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId")
    long countByAssigneeId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(DISTINCT uro.orgUnit.id) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses AND uro.orgUnit.parent IS NOT NULL")
    long countDistinctOrgUnitsOfAssigneesIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT k.id) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses")
    long countTotalKpiCriteriaIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT COUNT(DISTINCT CONCAT(CAST(k.id AS string), '_', CAST(a.id AS string))) FROM KpiCriteria k JOIN k.assignees a JOIN UserRoleOrgUnit uro ON uro.user.id = a.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND k.status IN :statuses")
    long countTotalAssignmentsIn(@Param("orgUnitIds") Collection<UUID> orgUnitIds, @Param("statuses") Collection<KpiStatus> statuses);

    @Query("SELECT k FROM KpiCriteria k WHERE k.orgUnit.id IN :orgUnitIds AND k.status = :status")
    List<KpiCriteria> findByOrgUnitIdInAndStatus(@Param("orgUnitIds") List<UUID> orgUnitIds, @Param("status") KpiStatus status);

    @Query("SELECT COALESCE(SUM(k.weight), 0.0) FROM KpiCriteria k JOIN k.assignees a WHERE a.id = :userId AND (:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND k.status IN :statuses")
    Double sumWeightByUserIdAndKpiPeriodIdAndStatusIn(@Param("userId") UUID userId, @Param("kpiPeriodId") UUID kpiPeriodId, @Param("statuses") List<KpiStatus> statuses);

    @Query("SELECT DISTINCT k FROM KpiCriteria k LEFT JOIN k.assignees a JOIN FETCH k.kpiPeriod " +
           "LEFT JOIN FETCH k.keyResult kr LEFT JOIN FETCH kr.objective obj WHERE " +
           "(a.id = :userId OR k.createdBy.id = :userId) AND " +
           "(:status IS NULL OR k.status = :status) AND " +
           "(:statuses IS NULL OR k.status IN :statuses) AND " +
           "(:kpiPeriodId IS NULL OR k.kpiPeriod.id = :kpiPeriodId) AND " +
           "(cast(:startDate as timestamp) IS NULL OR k.createdAt >= :startDate) AND " +
           "(cast(:endDate as timestamp) IS NULL OR k.createdAt <= :endDate) AND " +
           "(:objectiveId IS NULL OR k.keyResult.objective.id = :objectiveId) AND " +
           "(:keyResultId IS NULL OR k.keyResult.id = :keyResultId)")
    Page<KpiCriteria> findMyWithFilters(
            @Param("userId") UUID userId,
            @Param("status") KpiStatus status,
            @Param("statuses") Collection<KpiStatus> statuses,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("objectiveId") UUID objectiveId,
            @Param("keyResultId") UUID keyResultId,
            Pageable pageable
    );

    List<KpiCriteria> findByParentId(UUID parentId);
}
