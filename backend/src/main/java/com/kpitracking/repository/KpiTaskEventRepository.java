package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskEventRepository extends JpaRepository<KpiTaskEvent, UUID> {

    List<KpiTaskEvent> findByTaskIdOrderByCreatedAtDesc(UUID taskId);
}
