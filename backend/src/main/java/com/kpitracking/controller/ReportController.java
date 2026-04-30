package com.kpitracking.controller;

import com.kpitracking.dto.request.report.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.report.*;
import com.kpitracking.service.ReportService;
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
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Report & Chart management endpoints")
public class ReportController {

    private final ReportService reportService;

    // ============================================================
    // REPORT CRUD
    // ============================================================

    @PostMapping
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Create a new report")
    public ResponseEntity<ApiResponse<ReportResponse>> createReport(
            @Valid @RequestBody CreateReportRequest request) {
        ReportResponse response = reportService.createReport(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo báo cáo thành công", response));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "List reports")
    public ResponseEntity<ApiResponse<PageResponse<ReportResponse>>> getReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID orgUnitId) {
        PageResponse<ReportResponse> response = reportService.getReports(page, size, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get report by ID")
    public ResponseEntity<ApiResponse<ReportResponse>> getReport(@PathVariable UUID id) {
        ReportResponse response = reportService.getReportById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Update report")
    public ResponseEntity<ApiResponse<ReportResponse>> updateReport(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateReportRequest request) {
        ReportResponse response = reportService.updateReport(id, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật báo cáo thành công", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Soft delete report")
    public ResponseEntity<ApiResponse<Void>> deleteReport(@PathVariable UUID id) {
        reportService.deleteReport(id);
        return ResponseEntity.ok(ApiResponse.success("Xóa báo cáo thành công"));
    }

    // ============================================================
    // REPORT DATASOURCES
    // ============================================================

    @PostMapping("/{reportId}/datasources")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Link a datasource to report")
    public ResponseEntity<ApiResponse<ReportDatasourceResponse>> addDatasource(
            @PathVariable UUID reportId,
            @Valid @RequestBody AddReportDatasourceRequest request) {
        ReportDatasourceResponse response = reportService.addDatasource(reportId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Kết nối datasource thành công", response));
    }

    @DeleteMapping("/datasources/{reportDatasourceId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Unlink a datasource from report")
    public ResponseEntity<ApiResponse<Void>> removeDatasource(@PathVariable UUID reportDatasourceId) {
        reportService.removeDatasource(reportDatasourceId);
        return ResponseEntity.ok(ApiResponse.success("Ngắt kết nối datasource thành công"));
    }

    // ============================================================
    // WIDGETS
    // ============================================================

    @PostMapping("/{reportId}/widgets")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Add a widget to report")
    public ResponseEntity<ApiResponse<ReportWidgetResponse>> addWidget(
            @PathVariable UUID reportId,
            @Valid @RequestBody UpsertWidgetRequest request) {
        ReportWidgetResponse response = reportService.addWidget(reportId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Thêm widget thành công", response));
    }

    @PutMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Update a widget")
    public ResponseEntity<ApiResponse<ReportWidgetResponse>> updateWidget(
            @PathVariable UUID widgetId,
            @Valid @RequestBody UpsertWidgetRequest request) {
        ReportWidgetResponse response = reportService.updateWidget(widgetId, request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật widget thành công", response));
    }

    @DeleteMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Delete a widget")
    public ResponseEntity<ApiResponse<Void>> deleteWidget(@PathVariable UUID widgetId) {
        reportService.deleteWidget(widgetId);
        return ResponseEntity.ok(ApiResponse.success("Xóa widget thành công"));
    }
}
