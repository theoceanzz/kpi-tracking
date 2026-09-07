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

    /** Chỉ lấy cột mã — dùng để suy ra số thứ tự kế tiếp khi sinh mã tự động. */
    @org.springframework.data.jpa.repository.Query("SELECT kr.code FROM KeyResult kr WHERE kr.objective.organization.id = :orgId AND kr.code IS NOT NULL")
    java.util.List<String> findCodesByOrganizationId(@org.springframework.data.repository.query.Param("orgId") UUID orgId);

    @org.springframework.data.jpa.repository.Query("SELECT kr FROM KeyResult kr WHERE TRIM(LOWER(kr.code)) = TRIM(LOWER(:code)) AND kr.objective.organization.id = :orgId")
    java.util.Optional<KeyResult> findByCodeSmart(@org.springframework.data.repository.query.Param("code") String code, @org.springframework.data.repository.query.Param("orgId") UUID orgId);
}
