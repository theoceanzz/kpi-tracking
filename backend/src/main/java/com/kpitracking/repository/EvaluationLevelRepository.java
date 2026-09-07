package com.kpitracking.repository;

import com.kpitracking.entity.EvaluationLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface EvaluationLevelRepository extends JpaRepository<EvaluationLevel, UUID> {
    void deleteByOrganizationId(UUID organizationId);

    /** Ngưỡng xếp loại của tổ chức, cao xuống thấp — dùng vẽ vạch mốc trên histogram điểm. */
    java.util.List<EvaluationLevel> findByOrganizationIdOrderByThresholdDesc(UUID organizationId);
}
