package com.kpitracking.repository;

import com.kpitracking.entity.Evaluation;
import java.time.Instant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {

    Page<Evaluation> findByUserId(UUID userId, Pageable pageable);

    Page<Evaluation> findByKpiCriteriaId(UUID kpiCriteriaId, Pageable pageable);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id = :userId")
    Double avgScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    // ===== Analytics queries =====

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.id = :orgUnitId")
    Double avgScoreByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findAllByUserIdOrdered(@Param("userId") UUID userId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId AND e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findByUserIdAndPeriod(@Param("userId") UUID userId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.id IN :orgUnitIds")
    Double avgScoreByOrgUnitIdIn(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds);

    // ===== Statistic Tool queries =====

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double avgScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double minScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    Double maxScoreAllByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId AND e.deletedAt IS NULL")
    long countAllByOrgId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT TO_CHAR(e.created_at, :pattern) AS period_label, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY period_label ORDER BY period_label", nativeQuery = true)
    java.util.List<Object[]> trendGroupByPeriodByOrgId(@Param("orgId") UUID orgId, @Param("pattern") String datePattern);

    @Query(value = "SELECT ou.id, ou.name, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND ou.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY ou.id, ou.name ORDER BY avg_score DESC", nativeQuery = true)
    java.util.List<Object[]> avgScoreGroupByOrgUnitByOrgId(@Param("orgId") UUID orgId);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> topPerformersByOrgId(@Param("orgId") UUID orgId, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "JOIN org_hierarchy_levels ohl ON ou.org_hierarchy_id = ohl.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL AND ohl.organization_id = :orgId " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> lowPerformersByOrgId(@Param("orgId") UUID orgId, @Param("limit") int limit);

    // ===== OrgUnit Subtree Statistics =====

    @Query(value = "SELECT AVG(e.score) FROM evaluations e " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate", nativeQuery = true)
    Double findAvgScoreInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findTopPerformersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e " +
            "JOIN users u ON e.user_id = u.id " +
            "JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE ou.path LIKE CONCAT(:pathPrefix, '%') AND e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "AND e.created_at >= :startDate AND e.created_at <= :endDate " +
            "GROUP BY u.id, u.full_name, u.email " +
            "ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> findLowPerformersInSubtree(@Param("pathPrefix") String pathPrefix, @Param("startDate") Instant startDate, @Param("endDate") Instant endDate, @Param("limit") int limit);

    @Deprecated
    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double avgScoreAll();

    @Deprecated
    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double minScoreAll();

    @Deprecated
    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.deletedAt IS NULL")
    Double maxScoreAll();

    @Deprecated
    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.deletedAt IS NULL")
    long countAll();

    @Deprecated
    @Query(value = "SELECT TO_CHAR(e.created_at, :pattern) AS period_label, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e WHERE e.deleted_at IS NULL " +
            "GROUP BY period_label ORDER BY period_label", nativeQuery = true)
    java.util.List<Object[]> trendGroupByPeriod(@Param("pattern") String datePattern);

    @Deprecated
    @Query(value = "SELECT ou.id, ou.name, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN org_units ou ON e.org_unit_id = ou.id " +
            "WHERE e.deleted_at IS NULL AND ou.deleted_at IS NULL " +
            "GROUP BY ou.id, ou.name ORDER BY avg_score DESC", nativeQuery = true)
    java.util.List<Object[]> avgScoreGroupByOrgUnit();

    @Deprecated
    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score DESC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> topPerformers(@Param("limit") int limit);

    @Deprecated
    @Query(value = "SELECT u.id, u.full_name, u.email, AVG(e.score) AS avg_score, COUNT(e.id) AS eval_count " +
            "FROM evaluations e JOIN users u ON e.user_id = u.id " +
            "WHERE e.deleted_at IS NULL AND u.deleted_at IS NULL " +
            "GROUP BY u.id, u.full_name, u.email ORDER BY avg_score ASC LIMIT :limit", nativeQuery = true)
    java.util.List<Object[]> lowPerformers(@Param("limit") int limit);

    @Query("SELECT MIN(e.score) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    Double minScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT MAX(e.score) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    Double maxScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.user.id = :userId AND e.deletedAt IS NULL")
    long countByUserId(@Param("userId") UUID userId);
}
