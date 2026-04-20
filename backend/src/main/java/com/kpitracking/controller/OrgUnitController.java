package com.kpitracking.controller;

import java.io.IOException;

import com.kpitracking.dto.request.orgunit.CreateOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.MoveOrgUnitRequest;
import com.kpitracking.dto.request.orgunit.UpdateOrgUnitRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitResponse;
import com.kpitracking.dto.response.orgunit.OrgUnitTreeResponse;
import com.kpitracking.service.OrgUnitService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/units")
@RequiredArgsConstructor
@Tag(name = "Org Units", description = "Organization unit tree management endpoints")
public class OrgUnitController {

    private final OrgUnitService orgUnitService;

    @PostMapping
    @Operation(summary = "Create org unit")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> createOrgUnit(
            @PathVariable UUID orgId,
            @Valid @RequestBody CreateOrgUnitRequest request) {
        OrgUnitResponse response = orgUnitService.createOrgUnit(orgId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Org unit created successfully", response));
    }

    @PutMapping("/{unitId}")
    @Operation(summary = "Update org unit")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> updateOrgUnit(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId,
            @Valid @RequestBody UpdateOrgUnitRequest request) {
        OrgUnitResponse response = orgUnitService.updateOrgUnit(orgId, unitId, request);
        return ResponseEntity.ok(ApiResponse.success("Org unit updated successfully", response));
    }

    @GetMapping("/{unitId}")
    @Operation(summary = "Get org unit details")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> getOrgUnit(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId) {
        OrgUnitResponse response = orgUnitService.getOrgUnit(orgId, unitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{unitId}")
    @Operation(summary = "Soft delete org unit")
    public ResponseEntity<ApiResponse<Void>> deleteOrgUnit(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId) {
        orgUnitService.softDeleteOrgUnit(orgId, unitId);
        return ResponseEntity.ok(ApiResponse.success("Org unit deleted successfully"));
    }

    @PutMapping("/{unitId}/move")
    @Operation(summary = "Move org unit to new parent")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> moveOrgUnit(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId,
            @Valid @RequestBody MoveOrgUnitRequest request) {
        OrgUnitResponse response = orgUnitService.moveOrgUnit(orgId, unitId, request);
        return ResponseEntity.ok(ApiResponse.success("Org unit moved successfully", response));
    }

    @GetMapping("/tree")
    @Operation(summary = "Get full organization tree")
    public ResponseEntity<ApiResponse<List<OrgUnitTreeResponse>>> getOrgUnitTree(@PathVariable UUID orgId) {
        List<OrgUnitTreeResponse> response = orgUnitService.getOrgUnitTree(orgId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{unitId}/subtree")
    @Operation(summary = "Get subtree from a specific node")
    public ResponseEntity<ApiResponse<List<OrgUnitTreeResponse>>> getSubtree(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId) {
        List<OrgUnitTreeResponse> response = orgUnitService.getSubtree(orgId, unitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping(value = "/{unitId}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload org unit logo")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> uploadLogo(
            @PathVariable UUID orgId,
            @PathVariable UUID unitId,
            @RequestParam("file") MultipartFile file) throws IOException {
        OrgUnitResponse response = orgUnitService.uploadLogo(orgId, unitId, file);
        return ResponseEntity.ok(ApiResponse.success("Logo uploaded successfully", response));
    }
}
