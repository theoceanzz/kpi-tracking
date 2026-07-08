package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.service.PersonalObjectiveAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stats/personal/objectives")
@RequiredArgsConstructor
@Tag(name = "Personal Objective Analytics", description = "Personal objective dashboard endpoints")
public class PersonalObjectiveAnalyticsController {

    private final PersonalObjectiveAnalyticsService personalObjectiveAnalyticsService;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/metrics")
    @Operation(summary = "Get personal objective metrics")
    public ResponseEntity<ApiResponse<Metrics>> getMetrics(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getMetrics(w.from(), w.to(), onlyApproved, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/chart/combo")
    @Operation(summary = "Get data for personal combo chart")
    public ResponseEntity<ApiResponse<ComboChartData>> getComboChart(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false, defaultValue = "TIME") String groupBy) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getComboChart(w.from(), w.to(), onlyApproved, periodHelper.resolvePeriodIds(periodId, periodIdTo), groupBy)));
    }

    @GetMapping("/details")
    @Operation(summary = "Get detailed personal KPIs for table with sort, filter and pagination")
    public ResponseEntity<ApiResponse<PagedKpiDetailResponse>> getDetailedKpis(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String objectiveCode,
            @RequestParam(required = false) String keyResultCode,
            @RequestParam(required = false) String sharedType,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                personalObjectiveAnalyticsService.getDetailedKpis(
                        w.from(), w.to(), onlyApproved, sortBy, sortDir,
                        objectiveCode, keyResultCode, sharedType, page, size, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/kpis/{id}/drawer")
    @Operation(summary = "Get scoped metrics and chart data for a specific KPI drawer")
    public ResponseEntity<ApiResponse<DrawerData>> getKpiDrawerData(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getKpiDrawerData(id, w.from(), w.to(), onlyApproved)));
    }
}
