package com.kpitracking.repository;

import com.kpitracking.entity.KpiWorkflowConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiWorkflowConfigRepository extends JpaRepository<KpiWorkflowConfig, UUID> {

    Optional<KpiWorkflowConfig> findByOrganizationId(UUID organizationId);
}
