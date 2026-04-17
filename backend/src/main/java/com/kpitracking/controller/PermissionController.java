package com.kpitracking.controller;

import com.kpitracking.dto.request.permission.AssignPermissionRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.permission.PermissionResponse;
import com.kpitracking.service.PermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/permissions")
@RequiredArgsConstructor
@Tag(name = "Permissions", description = "Permission management endpoints")
public class PermissionController {

    private final PermissionService permissionService;

    @GetMapping
    @Operation(summary = "List all permissions")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> listPermissions() {
        List<PermissionResponse> response = permissionService.listAllPermissions();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/role/{roleId}")
    @Operation(summary = "Get permissions by role")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> getPermissionsByRole(@PathVariable UUID roleId) {
        List<PermissionResponse> response = permissionService.getPermissionsByRole(roleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/role/{roleId}")
    @Operation(summary = "Assign permissions to role")
    public ResponseEntity<ApiResponse<Void>> assignPermissions(
            @PathVariable UUID roleId,
            @Valid @RequestBody AssignPermissionRequest request) {
        permissionService.assignPermissionsToRole(roleId, request);
        return ResponseEntity.ok(ApiResponse.success("Permissions assigned successfully"));
    }

    @DeleteMapping("/role/{roleId}/{permissionId}")
    @Operation(summary = "Remove permission from role")
    public ResponseEntity<ApiResponse<Void>> removePermission(
            @PathVariable UUID roleId,
            @PathVariable UUID permissionId) {
        permissionService.removePermissionFromRole(roleId, permissionId);
        return ResponseEntity.ok(ApiResponse.success("Permission removed successfully"));
    }
}
