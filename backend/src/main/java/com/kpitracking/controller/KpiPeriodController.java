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
            @RequestParam(required = false) UUID organizationId) {

        PageResponse<KpiPeriodResponse> response = kpiPeriodService.getKpiPeriods(page, size, organizationId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
