package com.kpitracking.repository;

import com.kpitracking.entity.KpiReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiReminderRepository extends JpaRepository<KpiReminder, UUID> {
    Optional<KpiReminder> findByKpiCriteriaIdAndUserIdAndBatchNumber(UUID kpiCriteriaId, UUID userId, Integer batchNumber);
}
