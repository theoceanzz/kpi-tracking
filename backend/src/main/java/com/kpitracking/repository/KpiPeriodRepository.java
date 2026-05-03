package com.kpitracking.repository;

import com.kpitracking.entity.KpiPeriod;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KpiPeriodRepository extends JpaRepository<KpiPeriod, UUID>, JpaSpecificationExecutor<KpiPeriod> {
    java.util.Optional<KpiPeriod> findByName(String name);
    Page<KpiPeriod> findByOrganizationId(UUID organizationId, Pageable pageable);
}
