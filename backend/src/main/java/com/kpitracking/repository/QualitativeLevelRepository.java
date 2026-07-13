package com.kpitracking.repository;

import com.kpitracking.entity.QualitativeLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface QualitativeLevelRepository extends JpaRepository<QualitativeLevel, UUID> {
    void deleteByOrganizationId(UUID organizationId);
}
