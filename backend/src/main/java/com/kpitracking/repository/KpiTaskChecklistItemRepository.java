package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskChecklistItemRepository extends JpaRepository<KpiTaskChecklistItem, UUID> {

    List<KpiTaskChecklistItem> findByTaskIdOrderBySortOrderAscCreatedAtAsc(UUID taskId);

    List<KpiTaskChecklistItem> findByTaskIdIn(Collection<UUID> taskIds);
}
