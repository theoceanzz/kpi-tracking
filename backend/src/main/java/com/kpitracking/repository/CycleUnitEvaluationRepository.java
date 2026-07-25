package com.kpitracking.repository;

import com.kpitracking.entity.CycleUnitEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycleUnitEvaluationRepository extends JpaRepository<CycleUnitEvaluation, UUID> {

    Optional<CycleUnitEvaluation> findByKpiCycleIdAndOrgUnitId(UUID kpiCycleId, UUID orgUnitId);

    /** Mọi bản tổng hợp phòng ban của một kỳ — dùng để kiểm tra đã chốt hay chưa. */
    java.util.List<CycleUnitEvaluation> findByKpiCycleId(UUID kpiCycleId);
}
