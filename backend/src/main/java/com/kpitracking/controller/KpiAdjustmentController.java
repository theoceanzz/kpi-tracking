package com.kpitracking.controller;

import com.kpitracking.dto.request.kpi.BulkReviewAdjustmentRequest;
import com.kpitracking.dto.request.kpi.CreateAdjustmentRequest;
import com.kpitracking.dto.request.kpi.ReviewAdjustmentRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.AdjustmentRequestResponse;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.service.KpiAdjustmentService;
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
@RequestMapping("/api/v1/kpi-adjustments")
@RequiredArgsConstructor
@Tag(name = "KPI Adjustments", description = "Endpoints for staff to request KPI changes and managers to review them")
public class KpiAdjustmentController {

    private final KpiAdjustmentService adjustmentService;

    @PostMapping
    @Operation(summary = "Create an adjustment request")
    public ResponseEntity<ApiResponse<AdjustmentRequestResponse>> createRequest(
            @Valid @RequestBody CreateAdjustmentRequest request) {
        AdjustmentRequestResponse response = adjustmentService.createRequest(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Adjustment request submitted successfully", response));
    }

    @PostMapping("/bulk-review")
    @PreAuthorize("hasAuthority('KPI:APPROVE_ADJUSTMENT')")
    @Operation(summary = "Approve or reject multiple adjustment requests")
    public ResponseEntity<ApiResponse<Void>> bulkReviewRequests(
            @Valid @RequestBody BulkReviewAdjustmentRequest request) {
        adjustmentService.bulkReviewRequests(request);
        return ResponseEntity.ok(ApiResponse.success("Bulk review completed successfully", null));
    }

    @PostMapping("/{requestId}/review")
    @PreAuthorize("hasAuthority('KPI:APPROVE_ADJUSTMENT')")
    @Operation(summary = "Approve or reject an adjustment request")
    public ResponseEntity<ApiResponse<AdjustmentRequestResponse>> reviewRequest(
            @PathVariable UUID requestId,
            @Valid @RequestBody ReviewAdjustmentRequest request) {
        AdjustmentRequestResponse response = adjustmentService.reviewRequest(requestId, request);
        return ResponseEntity.ok(ApiResponse.success("Adjustment request reviewed successfully", response));
    }

    @GetMapping("/my")
    @Operation(summary = "Get current user's adjustment requests")
    public ResponseEntity<ApiResponse<PageResponse<AdjustmentRequestResponse>>> getMyRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<AdjustmentRequestResponse> response = adjustmentService.getMyRequests(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('KPI:APPROVE_ADJUSTMENT')")
    @Operation(summary = "List all adjustment requests (for managers)")
    public ResponseEntity<ApiResponse<PageResponse<AdjustmentRequestResponse>>> getAllRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) AdjustmentStatus status,
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID kpiPeriodId) {
        PageResponse<AdjustmentRequestResponse> response = adjustmentService.getAllRequests(page, size, status, orgUnitId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
