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
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Assign role to user at org unit")
    public ResponseEntity<ApiResponse<UserRoleOrgUnitResponse>> assignRole(
            @Valid @RequestBody AssignRoleRequest request) {
        UserRoleOrgUnitResponse response = userRoleService.assignRole(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Role assigned successfully", response));
    }

    @PostMapping("/assign/bulk")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Assign role to multiple users at org unit")
    public ResponseEntity<ApiResponse<List<UserRoleOrgUnitResponse>>> bulkAssignRole(
            @Valid @RequestBody com.kpitracking.dto.request.userrole.BulkAssignRoleRequest request) {
        List<UserRoleOrgUnitResponse> response = userRoleService.bulkAssignRole(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Roles assigned successfully to " + response.size() + " users", response));
    }

    @DeleteMapping("/revoke")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Revoke role from user at org unit")
    public ResponseEntity<ApiResponse<Void>> revokeRole(
            @RequestParam UUID userId,
            @RequestParam UUID roleId,
            @RequestParam UUID orgUnitId) {
        userRoleService.revokeRole(userId, roleId, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("Role revoked successfully"));
    }

    @DeleteMapping("/org-unit/{orgUnitId}/remove-all")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Remove all users from org unit")
    public ResponseEntity<ApiResponse<Void>> removeAllUsersFromOrgUnit(
            @PathVariable UUID orgUnitId) {
        userRoleService.removeAllUsersFromOrgUnit(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("All users removed from organization unit successfully"));
    }

    @DeleteMapping("/org-unit/{orgUnitId}/remove-bulk")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Remove bulk users from org unit")
    public ResponseEntity<ApiResponse<Void>> removeBulkUsersFromOrgUnit(
            @PathVariable UUID orgUnitId,
            @RequestBody List<UUID> userIds) {
        userRoleService.removeBulkUsersFromOrgUnit(userIds, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("Selected users removed from organization unit successfully"));
    }

    @GetMapping("/user/{userId}")
    @PreAuthorize("hasAuthority('ROLE:VIEW')")
    @Operation(summary = "Get user's roles across org units")
    public ResponseEntity<ApiResponse<List<UserRoleOrgUnitResponse>>> getUserRoles(@PathVariable UUID userId) {
        List<UserRoleOrgUnitResponse> response = userRoleService.getUserRoles(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/org-unit/{orgUnitId}")
    @PreAuthorize("hasAuthority('ROLE:VIEW')")
    @Operation(summary = "Get users in an org unit with their roles")
    public ResponseEntity<ApiResponse<List<UserRoleOrgUnitResponse>>> getUsersByOrgUnit(
            @PathVariable UUID orgUnitId) {
        List<UserRoleOrgUnitResponse> response = userRoleService.getUsersByOrgUnit(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
