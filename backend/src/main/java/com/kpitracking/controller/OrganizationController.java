package com.kpitracking.controller;

import com.kpitracking.dto.request.organization.CreateOrganizationRequest;
import com.kpitracking.dto.request.organization.UpdateOrganizationRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.service.OrganizationService;
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
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
@Tag(name = "Organizations", description = "Organization management endpoints")
public class OrganizationController {

    private final OrganizationService organizationService;

    @PostMapping
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Create organization")
    public ResponseEntity<ApiResponse<OrganizationResponse>> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationResponse response = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Organization created successfully", response));
    }

    @GetMapping("/{orgId}")
    @PreAuthorize("hasAnyAuthority('COMPANY:VIEW', 'EVALUATION:VIEW', 'DASHBOARD:VIEW')")
    @Operation(summary = "Get organization by ID")
    public ResponseEntity<ApiResponse<OrganizationResponse>> getOrganization(@PathVariable UUID orgId) {
        OrganizationResponse response = organizationService.getOrganization(orgId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('COMPANY:VIEW')")
    @Operation(summary = "List organizations")
    public ResponseEntity<ApiResponse<PageResponse<OrganizationResponse>>> listOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<OrganizationResponse> response = organizationService.listOrganizations(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{orgId}")
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    @Operation(summary = "Update organization")
    public ResponseEntity<ApiResponse<OrganizationResponse>> updateOrganization(
            @PathVariable UUID orgId,
            @Valid @RequestBody UpdateOrganizationRequest request) {
        OrganizationResponse response = organizationService.updateOrganization(orgId, request);
        return ResponseEntity.ok(ApiResponse.success("Organization updated successfully", response));
    }

    @DeleteMapping("/{orgId}")
    @PreAuthorize("hasAuthority('COMPANY:DELETE')")
    @Operation(summary = "Archive organization")
    public ResponseEntity<ApiResponse<Void>> deleteOrganization(@PathVariable UUID orgId) {
        organizationService.deleteOrganization(orgId);
        return ResponseEntity.ok(ApiResponse.success("Organization archived successfully"));
    }

    @GetMapping("/{orgId}/hierarchy-levels")
    @PreAuthorize("hasAuthority('ORG:VIEW')")
    @Operation(summary = "Get hierarchy levels for an organization")
    public ResponseEntity<ApiResponse<List<com.kpitracking.dto.response.organization.HierarchyLevelResponse>>> getHierarchyLevels(@PathVariable UUID orgId) {
        List<com.kpitracking.dto.response.organization.HierarchyLevelResponse> response = organizationService.getHierarchyLevels(orgId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
