package com.kpitracking.repository;

import com.kpitracking.entity.KpiCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KpiCycleRepository extends JpaRepository<KpiCycle, UUID>, JpaSpecificationExecutor<KpiCycle> {

    /** Số đợt (chưa xoá) đang thuộc kỳ này. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT COUNT(p) FROM KpiPeriod p WHERE p.kpiCycle.id = :cycleId AND p.deletedAt IS NULL")
    long countPeriods(@org.springframework.data.repository.query.Param("cycleId") UUID cycleId);
}
