package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiPeriodResponse;
import com.kpitracking.service.KpiPeriodService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-periods")
@RequiredArgsConstructor
public class KpiPeriodController {

    private final KpiPeriodService kpiPeriodService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<KpiPeriodResponse>>> getKpiPeriods(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startDate") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) com.kpitracking.enums.KpiFrequency periodType,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant endDate,
            @RequestParam(required = false) UUID organizationId) {

        PageResponse<KpiPeriodResponse> response = kpiPeriodService.getKpiPeriods(
                page, size, sortBy, direction, keyword, periodType, startDate, endDate, organizationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('KPI_PERIOD:CREATE')")
    public ResponseEntity<ApiResponse<KpiPeriodResponse>> createKpiPeriod(
            @RequestBody @jakarta.validation.Valid com.kpitracking.dto.request.kpi.KpiPeriodRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiPeriodService.createKpiPeriod(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_PERIOD:UPDATE')")
    public ResponseEntity<ApiResponse<KpiPeriodResponse>> updateKpiPeriod(
            @PathVariable UUID id,
            @RequestBody @jakarta.validation.Valid com.kpitracking.dto.request.kpi.KpiPeriodRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiPeriodService.updateKpiPeriod(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_PERIOD:DELETE')")
    public ResponseEntity<ApiResponse<Void>> deleteKpiPeriod(@PathVariable UUID id) {
        kpiPeriodService.deleteKpiPeriod(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
