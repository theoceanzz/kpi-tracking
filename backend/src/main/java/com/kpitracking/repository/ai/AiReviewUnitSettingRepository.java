package com.kpitracking.repository.ai;

import com.kpitracking.entity.ai.AiReviewUnitSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiReviewUnitSettingRepository extends JpaRepository<AiReviewUnitSetting, UUID> {

    List<AiReviewUnitSetting> findByOrganizationId(UUID organizationId);
}
