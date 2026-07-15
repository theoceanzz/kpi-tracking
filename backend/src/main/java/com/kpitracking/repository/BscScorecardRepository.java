package com.kpitracking.repository;

import com.kpitracking.entity.BscScorecard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscScorecardRepository extends JpaRepository<BscScorecard, UUID> {

    List<BscScorecard> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    Optional<BscScorecard> findByOrganizationIdAndKpiPeriodId(UUID organizationId, UUID kpiPeriodId);

    boolean existsByOrganizationIdAndKpiPeriodId(UUID organizationId, UUID kpiPeriodId);
}
