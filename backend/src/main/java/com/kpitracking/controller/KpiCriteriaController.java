package com.kpitracking.controller;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.service.KpiCriteriaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-criteria")
@RequiredArgsConstructor
@Tag(name = "KPI Criteria", description = "KPI Criteria management endpoints")
public class KpiCriteriaController {

    private final KpiCriteriaService kpiCriteriaService;

    @PostMapping
    @PreAuthorize("hasAuthority('KPI:CREATE')")
    @Operation(summary = "Create KPI criteria")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> createKpiCriteria(
            @Valid @RequestBody CreateKpiCriteriaRequest request) {
        KpiCriteriaResponse response = kpiCriteriaService.createKpiCriteria(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("KPI criteria created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "List KPI criteria with optional filters")
    public ResponseEntity<ApiResponse<PageResponse<KpiCriteriaResponse>>> getKpiCriteria(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) KpiStatus status,
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID createdById,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<KpiCriteriaResponse> response = kpiCriteriaService.getKpiCriteria(page, size, status, orgUnitId, createdById, kpiPeriodId, keyword, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{kpiId}")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get KPI criteria by ID")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> getKpiCriteria(@PathVariable UUID kpiId) {
        KpiCriteriaResponse response = kpiCriteriaService.getKpiCriteriaById(kpiId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{kpiId}")
    @PreAuthorize("hasAuthority('KPI:UPDATE')")
    @Operation(summary = "Update KPI criteria (DRAFT/REJECTED only)")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> updateKpiCriteria(
            @PathVariable UUID kpiId,
            @Valid @RequestBody UpdateKpiCriteriaRequest request) {
        KpiCriteriaResponse response = kpiCriteriaService.updateKpiCriteria(kpiId, request);
        return ResponseEntity.ok(ApiResponse.success("KPI criteria updated successfully", response));
    }

    @PostMapping("/{kpiId}/submit")
    @PreAuthorize("hasAuthority('KPI:CREATE')")
    @Operation(summary = "Submit KPI for approval")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> submitForApproval(@PathVariable UUID kpiId) {
        KpiCriteriaResponse response = kpiCriteriaService.submitForApproval(kpiId);
        return ResponseEntity.ok(ApiResponse.success("KPI submitted for approval", response));
    }

    @PostMapping("/{kpiId}/approve")
    @PreAuthorize("hasAuthority('KPI:APPROVE')")
    @Operation(summary = "Approve KPI criteria")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> approveKpi(@PathVariable UUID kpiId) {
        KpiCriteriaResponse response = kpiCriteriaService.approveKpi(kpiId);
        return ResponseEntity.ok(ApiResponse.success("KPI approved successfully", response));
    }

    @PostMapping("/{kpiId}/reject")
    @PreAuthorize("hasAuthority('KPI:APPROVE')")
    @Operation(summary = "Reject KPI criteria")
    public ResponseEntity<ApiResponse<KpiCriteriaResponse>> rejectKpi(
            @PathVariable UUID kpiId,
            @Valid @RequestBody RejectKpiRequest request) {
        KpiCriteriaResponse response = kpiCriteriaService.rejectKpi(kpiId, request);
        return ResponseEntity.ok(ApiResponse.success("KPI rejected", response));
    }

    @DeleteMapping("/{kpiId}")
    @PreAuthorize("hasAuthority('KPI:DELETE')")
    @Operation(summary = "Soft delete KPI criteria")
    public ResponseEntity<ApiResponse<Void>> deleteKpiCriteria(@PathVariable UUID kpiId) {
        kpiCriteriaService.deleteKpiCriteria(kpiId);
        return ResponseEntity.ok(ApiResponse.success("KPI criteria deleted successfully"));
    }

    @GetMapping("/my")
    @PreAuthorize("hasAuthority('KPI:VIEW_MY')")
    @Operation(summary = "Get KPI assigned to current user")
    public ResponseEntity<ApiResponse<PageResponse<KpiCriteriaResponse>>> getMyKpi(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        PageResponse<KpiCriteriaResponse> response = kpiCriteriaService.getMyKpi(page, size, kpiPeriodId, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/total-weight")
    @Operation(summary = "Get total weight of KPIs for an org unit or user and period")
    public ResponseEntity<ApiResponse<Double>> getTotalWeight(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) UUID kpiPeriodId) {
        Double totalWeight = kpiCriteriaService.getTotalWeight(orgUnitId, userId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success(totalWeight != null ? totalWeight : 0.0));
    }

    @PostMapping(value = "/import", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('KPI:CREATE')")
    @Operation(summary = "Import KPI criteria from CSV or Excel")
    public ResponseEntity<ApiResponse<com.kpitracking.dto.response.kpi.ImportKpiResponse>> importKpis(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) UUID orgUnitId) {
        com.kpitracking.dto.response.kpi.ImportKpiResponse response = kpiCriteriaService.importKpis(file, kpiPeriodId, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success("Import processed", response));
    }
}
