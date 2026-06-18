package com.kpitracking.repository;

import com.kpitracking.entity.KpiPeriod;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface KpiPeriodRepository extends JpaRepository<KpiPeriod, UUID>, JpaSpecificationExecutor<KpiPeriod> {

    /** Các kỳ KPI của tổ chức có endDate nằm trong khoảng [from, to], dùng cho DEADLINE_RISK. */
    @org.springframework.data.jpa.repository.Query("SELECT p FROM KpiPeriod p WHERE p.organization.id = :orgId " +
           "AND p.endDate IS NOT NULL AND p.endDate >= :from AND p.endDate <= :to ORDER BY p.endDate ASC")
    java.util.List<KpiPeriod> findEndingBetween(@org.springframework.data.repository.query.Param("orgId") UUID orgId,
                                                @org.springframework.data.repository.query.Param("from") Instant from,
                                                @org.springframework.data.repository.query.Param("to") Instant to);

    java.util.Optional<KpiPeriod> findByName(String name);
    java.util.Optional<KpiPeriod> findByNameIgnoreCase(String name);
    
    @org.springframework.data.jpa.repository.Query("SELECT p FROM KpiPeriod p WHERE TRIM(LOWER(p.name)) = TRIM(LOWER(:name)) AND p.organization.id = :orgId")
    java.util.Optional<KpiPeriod> findByNameSmart(@org.springframework.data.repository.query.Param("name") String name, @org.springframework.data.repository.query.Param("orgId") java.util.UUID orgId);

    java.util.Optional<KpiPeriod> findByNameIgnoreCaseAndOrganizationId(String name, UUID organizationId);
    Page<KpiPeriod> findByOrganizationId(UUID organizationId, Pageable pageable);
    Page<KpiPeriod> findAllByOrganizationIdOrderByStartDateDesc(UUID organizationId, Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM KpiPeriod p WHERE p.organization.id = :orgId " +
           "AND (:keyword IS NULL OR :keyword = '' OR LOWER(CAST(p.name AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))")
    java.util.List<KpiPeriod> searchByKeyword(@org.springframework.data.repository.query.Param("orgId") java.util.UUID orgId, @org.springframework.data.repository.query.Param("keyword") String keyword, Pageable pageable);
}
