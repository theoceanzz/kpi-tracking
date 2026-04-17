package com.kpitracking.controller;

import com.kpitracking.dto.request.policy.AddPolicyConditionRequest;
import com.kpitracking.dto.request.policy.CreatePolicyRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.policy.PolicyResponse;
import com.kpitracking.service.PolicyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/policies")
@RequiredArgsConstructor
@Tag(name = "Policies", description = "Policy management endpoints")
public class PolicyController {

    private final PolicyService policyService;

    @PostMapping
    @Operation(summary = "Create policy")
    public ResponseEntity<ApiResponse<PolicyResponse>> createPolicy(
            @Valid @RequestBody CreatePolicyRequest request) {
        PolicyResponse response = policyService.createPolicy(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Policy created successfully", response));
    }

    @GetMapping("/{policyId}")
    @Operation(summary = "Get policy detail with conditions")
    public ResponseEntity<ApiResponse<PolicyResponse>> getPolicyDetail(@PathVariable UUID policyId) {
        PolicyResponse response = policyService.getPolicyDetail(policyId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{policyId}/conditions")
    @Operation(summary = "Add condition to policy")
    public ResponseEntity<ApiResponse<PolicyResponse>> addCondition(
            @PathVariable UUID policyId,
            @Valid @RequestBody AddPolicyConditionRequest request) {
        PolicyResponse response = policyService.addCondition(policyId, request);
        return ResponseEntity.ok(ApiResponse.success("Condition added successfully", response));
    }

    @PostMapping("/role/{roleId}/{policyId}")
    @Operation(summary = "Assign policy to role")
    public ResponseEntity<ApiResponse<Void>> assignPolicyToRole(
            @PathVariable UUID roleId,
            @PathVariable UUID policyId) {
        policyService.assignPolicyToRole(roleId, policyId);
        return ResponseEntity.ok(ApiResponse.success("Policy assigned to role successfully"));
    }

    @DeleteMapping("/role/{roleId}/{policyId}")
    @Operation(summary = "Remove policy from role")
    public ResponseEntity<ApiResponse<Void>> removePolicyFromRole(
            @PathVariable UUID roleId,
            @PathVariable UUID policyId) {
        policyService.removePolicyFromRole(roleId, policyId);
        return ResponseEntity.ok(ApiResponse.success("Policy removed from role successfully"));
    }

    @GetMapping("/role/{roleId}")
    @Operation(summary = "Get policies by role")
    public ResponseEntity<ApiResponse<List<PolicyResponse>>> getPoliciesByRole(@PathVariable UUID roleId) {
        List<PolicyResponse> response = policyService.getPoliciesByRole(roleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
