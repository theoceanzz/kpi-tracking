package com.kpitracking.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.policy.AddPolicyConditionRequest;
import com.kpitracking.dto.request.policy.CreatePolicyRequest;
import com.kpitracking.dto.response.policy.PolicyResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.PolicyConditionType;
import com.kpitracking.enums.PolicyEffect;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.PolicyMapper;
import com.kpitracking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PolicyService {

    private final PolicyRepository policyRepository;
    private final PolicyConditionRepository policyConditionRepository;
    private final RolePolicyRepository rolePolicyRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final RoleRepository roleRepository;
    private final PolicyMapper policyMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public PolicyResponse createPolicy(CreatePolicyRequest request) {
        OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));

        PolicyEffect effect;
        try {
            effect = PolicyEffect.valueOf(request.getEffect().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid effect: " + request.getEffect() + ". Must be ALLOW or DENY");
        }

        Policy policy = Policy.builder()
                .orgUnit(orgUnit)
                .name(request.getName())
                .effect(effect)
                .build();

        policy = policyRepository.save(policy);
        return policyMapper.toResponse(policy);
    }

    @Transactional
    public PolicyResponse addCondition(UUID policyId, AddPolicyConditionRequest request) {
        Policy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Policy", "id", policyId));

        PolicyConditionType type;
        try {
            type = PolicyConditionType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid condition type: " + request.getType() + ". Must be ATTRIBUTE, TIME, or ORG_UNIT");
        }

        String conditionJsonStr;
        try {
            conditionJsonStr = objectMapper.writeValueAsString(request.getConditionJson());
        } catch (JsonProcessingException e) {
            throw new BusinessException("Invalid condition JSON format");
        }

        PolicyCondition condition = PolicyCondition.builder()
                .policy(policy)
                .type(type)
                .conditionJson(conditionJsonStr)
                .build();

        policyConditionRepository.save(condition);

        // Refresh policy with conditions
        policy = policyRepository.findById(policyId).orElseThrow();
        return policyMapper.toResponse(policy);
    }

    @Transactional
    public void assignPolicyToRole(UUID roleId, UUID policyId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        Policy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Policy", "id", policyId));

        if (rolePolicyRepository.existsByRoleIdAndPolicyId(roleId, policyId)) {
            throw new DuplicateResourceException("Policy already assigned to this role");
        }

        RolePolicy rolePolicy = RolePolicy.builder()
                .role(role)
                .policy(policy)
                .build();
        rolePolicyRepository.save(rolePolicy);
    }

    @Transactional
    public void removePolicyFromRole(UUID roleId, UUID policyId) {
        if (!rolePolicyRepository.existsByRoleIdAndPolicyId(roleId, policyId)) {
            throw new ResourceNotFoundException("RolePolicy not found");
        }
        rolePolicyRepository.deleteByRoleIdAndPolicyId(roleId, policyId);
    }

    @Transactional(readOnly = true)
    public List<PolicyResponse> getPoliciesByRole(UUID roleId) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        return rolePolicyRepository.findByRoleId(roleId).stream()
                .map(rp -> policyMapper.toResponse(rp.getPolicy()))
                .toList();
    }

    @Transactional(readOnly = true)
    public PolicyResponse getPolicyDetail(UUID policyId) {
        Policy policy = policyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("Policy", "id", policyId));
        return policyMapper.toResponse(policy);
    }
}
