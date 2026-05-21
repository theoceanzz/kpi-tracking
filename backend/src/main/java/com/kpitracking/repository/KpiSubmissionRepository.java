package com.kpitracking.repository;

import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.enums.SubmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface KpiSubmissionRepository extends JpaRepository<KpiSubmission, UUID> {

    @org.springframework.data.jpa.repository.Query("SELECT s FROM KpiSubmission s WHERE " +
           "(s.submittedBy.id = :currentUserId OR EXISTS (SELECT 1 FROM OrgUnit au WHERE s.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(s.status = COALESCE(:status, s.status)) AND " +
           "(s.kpiCriteria.kpiPeriod.id = COALESCE(:kpiPeriodId, s.kpiCriteria.kpiPeriod.id)) AND " +
           "(s.kpiCriteria.id = COALESCE(:kpiCriteriaId, s.kpiCriteria.id)) AND " +
           "(s.submittedBy.id = COALESCE(:submittedById, s.submittedBy.id)) AND " +
           "(s.orgUnit.path LIKE COALESCE(:orgUnitPath, s.orgUnit.path)) AND " +
           "(COALESCE(:currentUserLevel, 4) = 0 OR s.submittedBy.id = :currentUserId OR " +
           "EXISTS (SELECT 1 FROM UserRoleOrgUnit uro JOIN uro.role r WHERE uro.user.id = s.submittedBy.id AND uro.orgUnit.id = s.orgUnit.id AND " +
           "(r.level > :currentUserLevel OR (r.level = :currentUserLevel AND r.rank > :currentUserRank))))")
     Page<KpiSubmission> findAllWithFilters(
             @org.springframework.data.repository.query.Param("currentUserId") UUID currentUserId,
             @org.springframework.data.repository.query.Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
             @org.springframework.data.repository.query.Param("status") SubmissionStatus status,
             @org.springframework.data.repository.query.Param("kpiPeriodId") UUID kpiPeriodId,
             @org.springframework.data.repository.query.Param("kpiCriteriaId") UUID kpiCriteriaId,
             @org.springframework.data.repository.query.Param("submittedById") UUID submittedById,
             @org.springframework.data.repository.query.Param("orgUnitPath") String orgUnitPath,
             @org.springframework.data.repository.query.Param("currentUserRank") Integer currentUserRank,
             @org.springframework.data.repository.query.Param("currentUserLevel") Integer currentUserLevel,
             Pageable pageable
     );

    Page<KpiSubmission> findByStatus(SubmissionStatus status, Pageable pageable);

    Page<KpiSubmission> findByKpiCriteriaId(UUID kpiCriteriaId, Pageable pageable);

    Page<KpiSubmission> findBySubmittedById(UUID userId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.kpiCriteria.id IN :kpiIds AND s.deletedAt IS NULL")
    java.util.List<KpiSubmission> findBySubmittedByUserIdAndKpiCriteriaIdIn(@org.springframework.data.repository.query.Param("userId") UUID userId, @org.springframework.data.repository.query.Param("kpiIds") java.util.Collection<UUID> kpiIds);
    
    java.util.List<KpiSubmission> findByKpiCriteriaIdAndDeletedAtIsNull(UUID kpiCriteriaId);
    
    java.util.List<KpiSubmission> findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(UUID kpiCriteriaId, UUID submittedById);
    
    long countByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(UUID kpiCriteriaId, UUID userId);
    
    long countByKpiCriteriaIdAndSubmittedByIdAndStatusAndDeletedAtIsNull(UUID kpiCriteriaId, UUID userId, SubmissionStatus status);
    
    long countByKpiCriteriaIdAndSubmittedByIdAndStatusNotAndDeletedAtIsNull(UUID kpiCriteriaId, UUID userId, SubmissionStatus status);

    long countByOrgUnitId(UUID orgUnitId);

    long countByOrgUnitIdAndStatus(UUID orgUnitId, SubmissionStatus status);

    long countByStatus(SubmissionStatus status);

    long countByOrgUnitIdIn(java.util.Collection<UUID> orgUnitIds);

    long countByOrgUnitIdInAndStatus(java.util.Collection<UUID> orgUnitIds, SubmissionStatus status);

    long countBySubmittedById(UUID userId);

    long countBySubmittedByIdAndStatus(UUID userId, SubmissionStatus status);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.orgHierarchyLevel.organization.id = :orgId AND s.status = :status")
    long countByOrganizationIdAndStatus(@Param("orgId") UUID orgId, @Param("status") SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@org.springframework.data.repository.query.Param("path") String path);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.path LIKE :path AND s.status = :status")
    long countByOrgUnitPathAndStatus(@org.springframework.data.repository.query.Param("path") String path, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);
    // ===== Analytics queries =====

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    long countByOrgUnitIdInAndStatus(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @Param("status") SubmissionStatus status);

    @Query("SELECT s FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.createdAt >= :from AND s.createdAt <= :to ORDER BY s.createdAt DESC")
    java.util.List<KpiSubmission> findBySubmittedByIdAndPeriod(@Param("userId") UUID userId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    @Query("SELECT MAX(s.createdAt) FROM KpiSubmission s WHERE s.submittedBy.id = :userId")
    java.time.Instant findLatestSubmissionDateByUserId(@Param("userId") UUID userId);

    java.util.List<KpiSubmission> findBySubmittedByIdOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT COUNT(s) FROM KpiSubmission s WHERE s.kpiCriteria.id = :kpiId AND s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    long countByKpiCriteriaIdAndOrgUnitIdInAndStatus(@Param("kpiId") UUID kpiId, @Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @Param("status") SubmissionStatus status);

    @Query("SELECT COALESCE(SUM(s.actualValue), 0) FROM KpiSubmission s WHERE s.kpiCriteria.id = :kpiId AND s.orgUnit.id IN :orgUnitIds AND s.status = :status")
    double sumActualValueByKpiCriteriaIdAndOrgUnitIdInAndStatus(@Param("kpiId") UUID kpiId, @Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @Param("status") SubmissionStatus status);

    @Query("SELECT COALESCE(SUM(s.actualValue), 0) FROM KpiSubmission s WHERE s.submittedBy.id = :userId AND s.kpiCriteria.id = :kpiId AND s.status = 'APPROVED' AND s.createdAt >= :from AND s.createdAt <= :to")
    double sumActualValueByUserIdAndKpiIdInPeriod(@Param("userId") UUID userId, @Param("kpiId") UUID kpiId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    @Query("SELECT COALESCE(SUM(s.actualValue), 0) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds AND s.kpiCriteria.id = :kpiId AND s.status = 'APPROVED' AND s.createdAt >= :from AND s.createdAt <= :to")
    double sumActualValueByOrgUnitIdsAndKpiIdInPeriod(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds, @Param("kpiId") UUID kpiId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    // ===== Statistic Tool queries =====

    @Query(value =
            "SELECT s.id, u.full_name, u.email, ou.name AS org_unit_name, kc.name AS kpi_name, " +
            "s.created_at, s.period_end " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "WHERE s.deleted_at IS NULL AND s.period_end IS NOT NULL AND s.created_at > s.period_end " +
            "AND ohl.organization_id = :orgId " +
            "ORDER BY s.created_at DESC LIMIT 50", nativeQuery = true)
    java.util.List<Object[]> findLateSubmissionsByOrgId(@Param("orgId") UUID orgId);

    @Query(value =
            "SELECT s.status, COUNT(s.id) FROM kpi_submissions s " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE s.deleted_at IS NULL AND ohl.organization_id = :orgId GROUP BY s.status",
            nativeQuery = true)
    java.util.List<Object[]> countGroupByStatusByOrgId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT s.id, u.full_name, u.email, ou.name AS org_unit_name, kc.name AS kpi_name, " +
            "s.created_at, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.created_at))/86400 AS days_pending " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "WHERE s.status = 'PENDING' AND s.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "ORDER BY s.created_at ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findReviewBottlenecksByOrgId(@Param("orgId") UUID orgId, @Param("limit") int limit);

    // ===== OrgUnit Subtree Statistics =====

    @Query(value = "SELECT s.status, COUNT(s.id) FROM kpi_submissions s " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY s.status", nativeQuery = true)
    java.util.List<Object[]> countGroupByStatusInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    @Query(value = "SELECT u.id, u.full_name, u.email, " +
            "SUM(CASE WHEN s.status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id) AS completion_rate, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY completion_rate DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopPerformersByCompletionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, " +
            "SUM(CASE WHEN s.status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id) AS completion_rate, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY completion_rate ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowPerformersByCompletionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT ou.id, ou.name, " +
            "SUM(CASE WHEN s.status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id) AS completion_rate, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY ou.id, ou.name " +
            "ORDER BY completion_rate DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopUnitsByCompletionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT ou.id, ou.name, " +
            "SUM(CASE WHEN s.status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.id) AS completion_rate, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY ou.id, ou.name " +
            "ORDER BY completion_rate ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowUnitsByCompletionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT AVG(s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate", nativeQuery = true)
    Double findAvgPerformanceInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    @Query(value = "SELECT " +
            "CASE " +
            "  WHEN (s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) < 90 THEN 'BELOW' " +
            "  WHEN (s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) BETWEEN 90 AND 110 THEN 'MET' " +
            "  ELSE 'EXCEED' " +
            "END AS perf_category, COUNT(s.id) " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY perf_category", nativeQuery = true)
    java.util.List<Object[]> findPerformanceDistributionInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    @Query(value = "SELECT u.id, u.full_name, u.email, " +
            "AVG(s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) AS avg_perf, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' AND u.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_perf DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopPerformersByPerformanceInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, " +
            "AVG(s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) AS avg_perf, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' AND u.deleted_at IS NULL " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_perf ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowPerformersByPerformanceInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT ou.id, ou.name, " +
            "AVG(s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) AS avg_perf, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY ou.id, ou.name " +
            "ORDER BY avg_perf DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopUnitsByPerformanceInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT ou.id, ou.name, " +
            "AVG(s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) AS avg_perf, " +
            "COUNT(s.id) AS submission_count " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY ou.id, ou.name " +
            "ORDER BY avg_perf ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowUnitsByPerformanceInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, COUNT(s.id) AS late_count " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL " +
            "AND s.period_end IS NOT NULL AND s.created_at > s.period_end " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY late_count DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopLateSubmittersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, COUNT(s.id) AS underperform_count " +
            "FROM kpi_submissions s " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND s.deleted_at IS NULL AND s.status = 'APPROVED' " +
            "AND (s.actual_value * 100.0 / NULLIF(kc.target_value, 0)) < 90 " +
            "AND s.created_at >= :startDate AND s.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY underperform_count DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopUnderperformersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Deprecated
    @Query(value =
            "SELECT s.id, u.full_name, u.email, ou.name AS org_unit_name, kc.name AS kpi_name, " +
            "s.created_at, s.period_end " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "WHERE s.deleted_at IS NULL AND s.period_end IS NOT NULL AND s.created_at > s.period_end " +
            "ORDER BY s.created_at DESC LIMIT 50", nativeQuery = true)
    java.util.List<Object[]> findLateSubmissions();

    @Deprecated
    @Query(value =
            "SELECT s.status, COUNT(s.id) FROM kpi_submissions s WHERE s.deleted_at IS NULL GROUP BY s.status",
            nativeQuery = true)
    java.util.List<Object[]> countGroupByStatus();

    @Deprecated
    @Query(value =
            "SELECT s.id, u.full_name, u.email, ou.name AS org_unit_name, kc.name AS kpi_name, " +
            "s.created_at, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.created_at))/86400 AS days_pending " +
            "FROM kpi_submissions s " +
            "JOIN users u ON s.submitted_by = u.id " +
            "JOIN org_units ou ON s.org_unit_id = ou.id " +
            "JOIN kpi_criteria kc ON s.kpi_criteria_id = kc.id " +
            "WHERE s.status = 'PENDING' AND s.deleted_at IS NULL " +
            "ORDER BY s.created_at ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findReviewBottlenecks(@Param("limit") int limit);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT s.kpiCriteria.id) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds AND s.status != 'DRAFT' AND s.deletedAt IS NULL")
    long countDistinctKpiCriteriaWithSubmissionsIn(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT CONCAT(s.kpiCriteria.id, '_', s.submittedBy.id)) FROM KpiSubmission s WHERE s.orgUnit.id IN :orgUnitIds AND s.status != 'DRAFT' AND s.deletedAt IS NULL")
    long countDistinctAssignmentsWithSubmissionsIn(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT s.id) FROM KpiSubmission s JOIN UserRoleOrgUnit uro ON uro.user.id = s.submittedBy.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND s.status = :status AND s.deletedAt IS NULL")
    long countBySubmittedByUserOrgUnitInAndStatus(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds, @org.springframework.data.repository.query.Param("status") SubmissionStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT s.id) FROM KpiSubmission s JOIN UserRoleOrgUnit uro ON uro.user.id = s.submittedBy.id WHERE (uro.orgUnit.id IN :orgUnitIds OR EXISTS (SELECT 1 FROM OrgUnit au WHERE uro.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :orgUnitIds)) AND s.status = :status AND s.submittedBy.id != :excludedUserId AND s.deletedAt IS NULL")
    long countBySubmittedByUserOrgUnitInAndStatusExcludingUser(@org.springframework.data.repository.query.Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds, @org.springframework.data.repository.query.Param("status") SubmissionStatus status, @org.springframework.data.repository.query.Param("excludedUserId") UUID excludedUserId);
}
