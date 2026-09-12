package com.kpitracking.repository;

import com.kpitracking.entity.OrgCodeRule;
import com.kpitracking.enums.CodeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgCodeRuleRepository extends JpaRepository<OrgCodeRule, UUID> {

    List<OrgCodeRule> findByOrganizationId(UUID organizationId);

    Optional<OrgCodeRule> findByOrganizationIdAndCodeType(UUID organizationId, CodeType codeType);
}
