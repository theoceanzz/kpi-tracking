package com.kpitracking.repository;

import com.kpitracking.entity.KpiCycleEvent;
import com.kpitracking.enums.KpiCycleEventAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiCycleEventRepository extends JpaRepository<KpiCycleEvent, UUID> {

    List<KpiCycleEvent> findByKpiCycleIdOrderByCreatedAtDesc(UUID kpiCycleId);

    List<KpiCycleEvent> findByKpiCycleIdAndActionInOrderByCreatedAtDesc(UUID kpiCycleId, Collection<KpiCycleEventAction> actions);
}
