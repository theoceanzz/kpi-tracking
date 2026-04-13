package com.kpitracking.repository;

import com.kpitracking.entity.Evaluation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {

    Optional<Evaluation> findByIdAndCompanyId(UUID id, UUID companyId);

    Page<Evaluation> findByCompanyId(UUID companyId, Pageable pageable);

    Page<Evaluation> findByCompanyIdAndUserId(UUID companyId, UUID userId, Pageable pageable);

    Page<Evaluation> findByCompanyIdAndKpiCriteriaId(UUID companyId, UUID kpiCriteriaId, Pageable pageable);

    @Query("SELECT AVG(e.score) FROM Evaluation e WHERE e.company.id = :companyId AND e.user.id = :userId")
    Double avgScoreByCompanyIdAndUserId(@Param("companyId") UUID companyId,
                                        @Param("userId") UUID userId);

    long countByCompanyId(UUID companyId);
}
