package com.kpitracking.repository.notification;

import com.kpitracking.entity.notification.EvaluationReminder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EvaluationReminderRepository extends JpaRepository<EvaluationReminder, UUID> {

    boolean existsByScopeAndTargetIdAndOrgUnitIdAndUserIdAndMilestone(
            String scope, UUID targetId, UUID orgUnitId, UUID userId, String milestone);
}
