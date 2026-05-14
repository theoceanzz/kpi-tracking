package com.kpitracking.repository;

import com.kpitracking.entity.KeyResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KeyResultRepository extends JpaRepository<KeyResult, UUID> {
    java.util.List<KeyResult> findByObjectiveId(UUID objectiveId);
    boolean existsByObjectiveOrganizationIdAndCode(UUID organizationId, String code);
    boolean existsByObjectiveOrganizationIdAndCodeAndIdNot(UUID organizationId, String code, UUID id);

    @org.springframework.data.jpa.repository.Query("SELECT kr FROM KeyResult kr WHERE TRIM(LOWER(kr.code)) = TRIM(LOWER(:code)) AND kr.objective.organization.id = :orgId")
    java.util.Optional<KeyResult> findByCodeSmart(@org.springframework.data.repository.query.Param("code") String code, @org.springframework.data.repository.query.Param("orgId") UUID orgId);
}
