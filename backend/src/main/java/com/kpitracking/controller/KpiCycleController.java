package com.kpitracking.controller;

import com.kpitracking.dto.request.kpi.KpiCycleRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCycleResponse;
import com.kpitracking.service.KpiCycleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/kpi-cycles")
@RequiredArgsConstructor
public class KpiCycleController {

    private final KpiCycleService kpiCycleService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<KpiCycleResponse>>> getKpiCycles(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "startDate") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) com.kpitracking.enums.KpiFrequency cycleType,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.Instant endDate,
            @RequestParam(required = false) UUID organizationId) {

        PageResponse<KpiCycleResponse> response = kpiCycleService.getKpiCycles(
                page, size, sortBy, direction, keyword, cycleType, startDate, endDate, organizationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('KPI_CYCLE:CREATE')")
    public ResponseEntity<ApiResponse<KpiCycleResponse>> createKpiCycle(
            @RequestBody @jakarta.validation.Valid KpiCycleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleService.createKpiCycle(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_CYCLE:UPDATE')")
    public ResponseEntity<ApiResponse<KpiCycleResponse>> updateKpiCycle(
            @PathVariable UUID id,
            @RequestBody @jakarta.validation.Valid KpiCycleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(kpiCycleService.updateKpiCycle(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('KPI_CYCLE:DELETE')")
    public ResponseEntity<ApiResponse<Void>> deleteKpiCycle(@PathVariable UUID id) {
        kpiCycleService.deleteKpiCycle(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
