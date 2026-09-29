package com.kpitracking.repository;

import com.kpitracking.entity.AiReviewUnitSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiReviewUnitSettingRepository extends JpaRepository<AiReviewUnitSetting, UUID> {

    List<AiReviewUnitSetting> findByOrganizationId(UUID organizationId);
}
