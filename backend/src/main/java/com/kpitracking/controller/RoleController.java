package com.kpitracking.controller;

import com.kpitracking.dto.request.role.CreateRoleRequest;
import com.kpitracking.dto.request.role.UpdateRoleRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.role.RoleResponse;
import com.kpitracking.service.RoleService;
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
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('DIRECTOR')")
@Tag(name = "Roles", description = "Role management endpoints")
public class RoleController {

    private final RoleService roleService;

    @PostMapping
    @Operation(summary = "Create role")
    public ResponseEntity<ApiResponse<RoleResponse>> createRole(@Valid @RequestBody CreateRoleRequest request) {
        RoleResponse response = roleService.createRole(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Role created successfully", response));
    }

    @PutMapping("/{roleId}")
    @Operation(summary = "Update role")
    public ResponseEntity<ApiResponse<RoleResponse>> updateRole(
            @PathVariable UUID roleId,
            @Valid @RequestBody UpdateRoleRequest request) {
        RoleResponse response = roleService.updateRole(roleId, request);
        return ResponseEntity.ok(ApiResponse.success("Role updated successfully", response));
    }

    @DeleteMapping("/{roleId}")
    @Operation(summary = "Soft delete role")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable UUID roleId) {
        roleService.deleteRole(roleId);
        return ResponseEntity.ok(ApiResponse.success("Role deleted successfully"));
    }

    @GetMapping
    @Operation(summary = "List all active roles")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> listRoles() {
        List<RoleResponse> response = roleService.listRoles();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{roleId}")
    @Operation(summary = "Get role detail")
    public ResponseEntity<ApiResponse<RoleResponse>> getRole(@PathVariable UUID roleId) {
        RoleResponse response = roleService.getRole(roleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
