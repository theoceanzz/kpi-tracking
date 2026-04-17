package com.kpitracking.repository;

import com.kpitracking.entity.PolicyCondition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PolicyConditionRepository extends JpaRepository<PolicyCondition, UUID> {

    List<PolicyCondition> findByPolicyId(UUID policyId);
}
