package com.kpitracking.repository;

import com.kpitracking.entity.CycleUserEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycleUserEvaluationRepository extends JpaRepository<CycleUserEvaluation, UUID> {

    Optional<CycleUserEvaluation> findByKpiCycleIdAndUserId(UUID kpiCycleId, UUID userId);

    List<CycleUserEvaluation> findByKpiCycleIdAndUserIdIn(UUID kpiCycleId, List<UUID> userIds);
}
