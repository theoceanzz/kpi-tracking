package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.service.PersonalKpiAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stats/personal/kpis")
@RequiredArgsConstructor
@Tag(name = "Personal KPI Analytics", description = "Personal standalone KPI dashboard endpoints")
public class PersonalKpiAnalyticsController {

    private final PersonalKpiAnalyticsService personalKpiAnalyticsService;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/metrics")
    @Operation(summary = "Get standalone KPI metrics")
    public ResponseEntity<ApiResponse<Metrics>> getMetrics(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getMetrics(w.from(), w.to(), onlyApproved, periodId)));
    }

    @GetMapping("/chart/combo")
    @Operation(summary = "Get combo chart data for standalone KPIs")
    public ResponseEntity<ApiResponse<ComboChartData>> getComboChart(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getComboChart(w.from(), w.to(), onlyApproved, periodId)));
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
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(
                personalKpiAnalyticsService.getDetailedKpis(
                        w.from(), w.to(), onlyApproved, sortBy, sortDir, sharedType, page, size, periodId)));
    }
}
