package com.kpitracking.repository;

import com.kpitracking.entity.ConductEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConductEvaluationRepository extends JpaRepository<ConductEvaluation, UUID> {

    Optional<ConductEvaluation> findByUserIdAndKpiPeriodId(UUID userId, UUID kpiPeriodId);

    Optional<ConductEvaluation> findByUserIdAndKpiCycleId(UUID userId, UUID kpiCycleId);

    List<ConductEvaluation> findByKpiPeriodIdAndUserIdIn(UUID kpiPeriodId, List<UUID> userIds);

    List<ConductEvaluation> findByKpiCycleIdAndUserIdIn(UUID kpiCycleId, List<UUID> userIds);
}
