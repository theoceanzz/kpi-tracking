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
            "(:userId IS NULL OR e.user.id = :userId) AND " +
            "(:kpiPeriodId IS NULL OR e.kpiPeriod.id = :kpiPeriodId) AND " +
            "(:orgUnitPath IS NULL OR e.orgUnit.path LIKE :orgUnitPath) AND " +
            "(:evaluatorId IS NULL OR e.evaluator.id = :evaluatorId)")
    Page<Evaluation> findAllWithFilters(
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("orgUnitPath") String orgUnitPath,
            @Param("evaluatorId") UUID evaluatorId,
            Pageable pageable
    );

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id = :userId")
    Double avgScoreByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.orgHierarchyLevel.organization.id = :orgId")
    long countByOrganizationId(@Param("orgId") UUID orgId);

    @Query("SELECT COUNT(e) > 0 FROM Evaluation e WHERE e.user.id = :userId AND e.kpiPeriod.id = :kpiPeriodId AND e.evaluator.id = :evaluatorId")
    boolean existsByUserIdAndKpiPeriodIdAndEvaluatorId(
            @Param("userId") UUID userId,
            @Param("kpiPeriodId") UUID kpiPeriodId,
            @Param("evaluatorId") UUID evaluatorId
    );

    @Query("SELECT COUNT(e) FROM Evaluation e WHERE e.orgUnit.path LIKE :path")
    long countByOrgUnitPath(@Param("path") String path);
}
