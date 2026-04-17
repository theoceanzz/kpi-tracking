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
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
@RequiredArgsConstructor
@Tag(name = "Organizations", description = "Organization management endpoints")
public class OrganizationController {

    private final OrganizationService organizationService;

    @PostMapping
    @Operation(summary = "Create organization")
    public ResponseEntity<ApiResponse<OrganizationResponse>> createOrganization(
            @Valid @RequestBody CreateOrganizationRequest request) {
        OrganizationResponse response = organizationService.createOrganization(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Organization created successfully", response));
    }

    @GetMapping("/{orgId}")
    @Operation(summary = "Get organization by ID")
    public ResponseEntity<ApiResponse<OrganizationResponse>> getOrganization(@PathVariable UUID orgId) {
        OrganizationResponse response = organizationService.getOrganization(orgId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "List organizations")
    public ResponseEntity<ApiResponse<PageResponse<OrganizationResponse>>> listOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<OrganizationResponse> response = organizationService.listOrganizations(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{orgId}")
    @Operation(summary = "Update organization")
    public ResponseEntity<ApiResponse<OrganizationResponse>> updateOrganization(
            @PathVariable UUID orgId,
            @Valid @RequestBody UpdateOrganizationRequest request) {
        OrganizationResponse response = organizationService.updateOrganization(orgId, request);
        return ResponseEntity.ok(ApiResponse.success("Organization updated successfully", response));
    }

    @DeleteMapping("/{orgId}")
    @Operation(summary = "Archive organization")
    public ResponseEntity<ApiResponse<Void>> deleteOrganization(@PathVariable UUID orgId) {
        organizationService.deleteOrganization(orgId);
        return ResponseEntity.ok(ApiResponse.success("Organization archived successfully"));
    }
}
