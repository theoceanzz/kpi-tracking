package com.kpitracking.repository;

import com.kpitracking.entity.CycleUnitEvalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CycleUnitEvalEventRepository extends JpaRepository<CycleUnitEvalEvent, UUID> {

    List<CycleUnitEvalEvent> findByKpiCycleIdAndOrgUnitIdOrderByCreatedAtDesc(UUID cycleId, UUID orgUnitId);

    /** Nạp lịch sử cho cả chuỗi duyệt trong 1 query. */
    List<CycleUnitEvalEvent> findByKpiCycleIdAndOrgUnitIdInOrderByCreatedAtAsc(UUID cycleId, Collection<UUID> orgUnitIds);
}
