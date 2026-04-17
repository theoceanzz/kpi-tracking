package com.kpitracking.controller;

import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.userrole.UserRoleOrgUnitResponse;
import com.kpitracking.service.UserRoleService;
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
@RequestMapping("/api/v1/user-roles")
@RequiredArgsConstructor
@Tag(name = "User Roles", description = "User-Role-OrgUnit assignment endpoints")
public class UserRoleController {

    private final UserRoleService userRoleService;

    @PostMapping("/assign")
    @Operation(summary = "Assign role to user at org unit")
    public ResponseEntity<ApiResponse<UserRoleOrgUnitResponse>> assignRole(
            @Valid @RequestBody AssignRoleRequest request) {
        UserRoleOrgUnitResponse response = userRoleService.assignRole(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Role assigned successfully", response));
    }

    @DeleteMapping("/revoke")
    @Operation(summary = "Revoke role from user at org unit")
    public ResponseEntity<ApiResponse<Void>> revokeRole(
            @RequestParam UUID userId,
            @RequestParam UUID roleId,
            @RequestParam UUID orgUnitId) {
        userRoleService.revokeRole(userId, roleId, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("Role revoked successfully"));
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get user's roles across org units")
    public ResponseEntity<ApiResponse<List<UserRoleOrgUnitResponse>>> getUserRoles(@PathVariable UUID userId) {
        List<UserRoleOrgUnitResponse> response = userRoleService.getUserRoles(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/org-unit/{orgUnitId}")
    @Operation(summary = "Get users in an org unit with their roles")
    public ResponseEntity<ApiResponse<List<UserRoleOrgUnitResponse>>> getUsersByOrgUnit(
            @PathVariable UUID orgUnitId) {
        List<UserRoleOrgUnitResponse> response = userRoleService.getUsersByOrgUnit(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
