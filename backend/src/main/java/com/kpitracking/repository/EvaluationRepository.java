package com.kpitracking.repository;

import com.kpitracking.entity.Evaluation;
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

    Page<Evaluation> findByKpiPeriodId(UUID kpiPeriodId, Pageable pageable);

    Page<Evaluation> findByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId, Pageable pageable);

    @Query("SELECT e FROM Evaluation e WHERE " +
           "(e.user.id = :currentUserId OR e.evaluator.id = :currentUserId OR EXISTS (SELECT 1 FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND EXISTS (SELECT 1 FROM OrgUnit au_perm WHERE uro_sub.orgUnit.path LIKE CONCAT(au_perm.path, '%') AND au_perm.id IN :allowedOrgUnitIds)) OR EXISTS (SELECT 1 FROM OrgUnit au WHERE e.orgUnit.path LIKE CONCAT(au.path, '%') AND au.id IN :allowedOrgUnitIds)) AND " +
           "(:userId IS NULL OR e.user.id = :userId) AND " +
           "(:kpiPeriodId IS NULL OR e.kpiPeriod.id = :kpiPeriodId) AND " +
           "(:orgUnitPath IS NULL OR e.orgUnit.path LIKE :orgUnitPath) AND " +
           "(:evaluatorId IS NULL OR e.evaluator.id = :evaluatorId) AND " +
           "(:currentUserRank IS NULL OR :currentUserLevel = 0 OR e.user.id = :currentUserId OR e.evaluator.id = :currentUserId OR " +
           "(SELECT MIN(COALESCE(uro_sub.role.level, 4)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) > :currentUserLevel OR " +
           "((SELECT MIN(COALESCE(uro_sub.role.level, 4)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) = :currentUserLevel AND " +
           "(SELECT MIN(COALESCE(uro_sub.role.rank, 2)) FROM UserRoleOrgUnit uro_sub WHERE uro_sub.user.id = e.user.id AND e.orgUnit.path LIKE CONCAT(uro_sub.orgUnit.path, '%')) > :currentUserRank))")
    Page<Evaluation> findAllWithFilters(
            @Param("currentUserId") UUID currentUserId,
            @Param("allowedOrgUnitIds") java.util.Collection<UUID> allowedOrgUnitIds,
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("evaluatorId") UUID evaluatorId,
            @Param("currentUserRank") Integer currentUserRank,
            @Param("currentUserLevel") Integer currentUserLevel,
            Pageable pageable
    );

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id = :userId")
    Double avgScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId AND e.kpiPeriod.id = :kpiPeriodId AND e.evaluator.id = :evaluatorId")
    java.util.Optional<Evaluation> findByUserIdAndKpiPeriodIdAndEvaluatorId(
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("evaluatorId") UUID evaluatorId
    );

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@Param("path") String path);
    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.id IN :orgUnitIds")
    long countByOrgUnitIdIn(@Param("orgUnitIds") java.util.Collection<UUID> orgUnitIds);
    // ===== Analytics queries =====

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.id = :orgUnitId")
    Double avgScoreByOrgUnitId(@Param("orgUnitId") UUID orgUnitId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findAllByUserIdOrdered(@Param("userId") UUID userId);

    @Query("SELECT e FROM Evaluation e WHERE e.user.id = :userId AND e.createdAt >= :from AND e.createdAt <= :to ORDER BY e.createdAt DESC")
    java.util.List<Evaluation> findByUserIdAndPeriod(@Param("userId") UUID userId, @Param("from") java.time.Instant from, @Param("to") java.time.Instant to);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.orgUnit.id IN :orgUnitIds")
    Double avgScoreByOrgUnitIdIn(@Param("orgUnitIds") java.util.List<UUID> orgUnitIds);
}
