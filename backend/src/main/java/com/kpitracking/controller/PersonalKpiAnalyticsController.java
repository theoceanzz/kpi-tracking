package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.service.PersonalKpiAnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/stats/personal/kpis")
@RequiredArgsConstructor
@Tag(name = "Personal KPI Analytics", description = "Personal standalone KPI dashboard endpoints")
public class PersonalKpiAnalyticsController {

    private final PersonalKpiAnalyticsService personalKpiAnalyticsService;

    @GetMapping("/metrics")
    @Operation(summary = "Get standalone KPI metrics")
    public ResponseEntity<ApiResponse<Metrics>> getMetrics(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getMetrics(from, to, onlyApproved)));
    }

    @GetMapping("/chart/combo")
    @Operation(summary = "Get combo chart data for standalone KPIs")
    public ResponseEntity<ApiResponse<ComboChartData>> getComboChart(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getComboChart(from, to, onlyApproved)));
    }

    @GetMapping("/details")
    @Operation(summary = "Get paged standalone KPI detail table with sort, filter and pagination")
    public ResponseEntity<ApiResponse<PagedKpiDetailResponse>> getDetailedKpis(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String sharedType,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getDetailedKpis(
                        from, to, onlyApproved, sortBy, sortDir, sharedType, page, size)));
    }
}
