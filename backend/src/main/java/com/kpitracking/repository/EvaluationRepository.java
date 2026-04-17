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

    Page<Evaluation> findByKpiCriteriaId(UUID kpiCriteriaId, Pageable pageable);

<<<<<<< HEAD
    Page<Evaluation> findByCompanyIdAndUserId(UUID companyId, UUID userId, Pageable pageable);

    Page<Evaluation> findByCompanyIdAndKpiCriteriaId(UUID companyId, UUID kpiCriteriaId, Pageable pageable);

    Page<Evaluation> findByCompanyIdAndKpiCriteriaDepartmentId(UUID companyId, UUID departmentId, Pageable pageable);

    Page<Evaluation> findByCompanyIdAndKpiCriteriaDepartmentIdIn(UUID companyId, java.util.Collection<UUID> departmentIds, Pageable pageable);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.company.id = :companyId AND e.user.id = :userId")
    Double avgScoreByCompanyIdAndUserId(@Param("companyId") UUID companyId,
                                        @Param("userId") UUID userId);

    long countByCompanyId(UUID companyId);
=======
    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.user.id = :userId")
    Double avgScoreByUserId(@Param("userId") UUID userId);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
}
