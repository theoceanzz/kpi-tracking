package com.kpitracking.controller;

import com.kpitracking.dto.request.department.AddMemberRequest;
import com.kpitracking.dto.request.department.CreateDepartmentRequest;
import com.kpitracking.dto.request.department.UpdateDepartmentRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.department.DepartmentMemberResponse;
import com.kpitracking.dto.response.department.DepartmentResponse;
import com.kpitracking.service.DepartmentService;
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
@RequestMapping("/api/v1/departments")
@RequiredArgsConstructor
@Tag(name = "Departments", description = "Department management endpoints")
public class DepartmentController {

    private final DepartmentService departmentService;

    @PostMapping
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Create department (Director only)")
    public ResponseEntity<ApiResponse<DepartmentResponse>> createDepartment(
            @Valid @RequestBody CreateDepartmentRequest request) {
        DepartmentResponse response = departmentService.createDepartment(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Department created successfully", response));
    }

    @GetMapping
    @Operation(summary = "List departments")
    public ResponseEntity<ApiResponse<PageResponse<DepartmentResponse>>> getDepartments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<DepartmentResponse> response = departmentService.getDepartments(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{departmentId}")
    @Operation(summary = "Get department by ID")
    public ResponseEntity<ApiResponse<DepartmentResponse>> getDepartment(@PathVariable UUID departmentId) {
        DepartmentResponse response = departmentService.getDepartmentById(departmentId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{departmentId}")
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Update department (Director only)")
    public ResponseEntity<ApiResponse<DepartmentResponse>> updateDepartment(
            @PathVariable UUID departmentId,
            @Valid @RequestBody UpdateDepartmentRequest request) {
        DepartmentResponse response = departmentService.updateDepartment(departmentId, request);
        return ResponseEntity.ok(ApiResponse.success("Department updated successfully", response));
    }

    @DeleteMapping("/{departmentId}")
    @PreAuthorize("hasRole('DIRECTOR')")
    @Operation(summary = "Soft delete department (Director only)")
    public ResponseEntity<ApiResponse<Void>> deleteDepartment(@PathVariable UUID departmentId) {
        departmentService.deleteDepartment(departmentId);
        return ResponseEntity.ok(ApiResponse.success("Department deleted successfully"));
    }

    @PostMapping("/{departmentId}/members")
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD')")
    @Operation(summary = "Add member to department")
    public ResponseEntity<ApiResponse<DepartmentMemberResponse>> addMember(
            @PathVariable UUID departmentId,
            @Valid @RequestBody AddMemberRequest request) {
        DepartmentMemberResponse response = departmentService.addMember(departmentId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Member added successfully", response));
    }

    @DeleteMapping("/{departmentId}/members/{userId}")
    @PreAuthorize("hasAnyRole('DIRECTOR', 'HEAD')")
    @Operation(summary = "Remove member from department")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable UUID departmentId,
            @PathVariable UUID userId) {
        departmentService.removeMember(departmentId, userId);
        return ResponseEntity.ok(ApiResponse.success("Member removed successfully"));
    }

    @GetMapping("/{departmentId}/members")
    @Operation(summary = "List department members")
    public ResponseEntity<ApiResponse<List<DepartmentMemberResponse>>> getMembers(@PathVariable UUID departmentId) {
        List<DepartmentMemberResponse> response = departmentService.getMembers(departmentId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
