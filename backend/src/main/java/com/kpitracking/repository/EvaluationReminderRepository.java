package com.kpitracking.repository;

import com.kpitracking.entity.EvaluationReminder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EvaluationReminderRepository extends JpaRepository<EvaluationReminder, UUID> {

    boolean existsByScopeAndTargetIdAndOrgUnitIdAndUserIdAndMilestone(
            String scope, UUID targetId, UUID orgUnitId, UUID userId, String milestone);
}
