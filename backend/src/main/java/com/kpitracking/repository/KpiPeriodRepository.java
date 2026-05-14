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
    java.util.Optional<KpiPeriod> findByNameIgnoreCase(String name);
    
    @org.springframework.data.jpa.repository.Query("SELECT p FROM KpiPeriod p WHERE TRIM(LOWER(p.name)) = TRIM(LOWER(:name)) AND p.organization.id = :orgId")
    java.util.Optional<KpiPeriod> findByNameSmart(@org.springframework.data.repository.query.Param("name") String name, @org.springframework.data.repository.query.Param("orgId") java.util.UUID orgId);

    java.util.Optional<KpiPeriod> findByNameIgnoreCaseAndOrganizationId(String name, UUID organizationId);
    Page<KpiPeriod> findByOrganizationId(UUID organizationId, Pageable pageable);
    Page<KpiPeriod> findAllByOrganizationIdOrderByStartDateDesc(UUID organizationId, Pageable pageable);
}
