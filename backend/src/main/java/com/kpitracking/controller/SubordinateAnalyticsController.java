package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.SubordinateStatsResponses.*;
import com.kpitracking.dto.response.stats.SubordinateStatsResponses;
import com.kpitracking.dto.response.stats.SubordinateDetailsResponses.*; 
import com.kpitracking.dto.response.stats.SubordinateDetailsResponses;
import com.kpitracking.dto.response.stats.ScopedDashboardResponse;
import com.kpitracking.service.SubordinateAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stats/subordinates")
@RequiredArgsConstructor
@Tag(name = "Subordinate Analytics", description = "Subordinate objective dashboard endpoints")
public class SubordinateAnalyticsController {

    private final SubordinateAnalyticsService subordinateAnalyticsService;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/metrics/completion")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get overall completion rate")
    public ResponseEntity<ApiResponse<MetricValueResponse>> getCompletionRate(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getCompletionRate(w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/metrics/performance")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get overall performance rate")
    public ResponseEntity<ApiResponse<MetricValueResponse>> getPerformanceRate(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getPerformanceRate(w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/metrics/completed-count")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get completed objectives count")
    public ResponseEntity<ApiResponse<CompletedCountResponse>> getCompletedCount(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getCompletedCount(w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/metrics/at-risk")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get at-risk objectives count")
    public ResponseEntity<ApiResponse<CountResponse>> getAtRiskCount(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getAtRiskCount(w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/metrics/personnel")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get total personnel count")
    public ResponseEntity<ApiResponse<CountResponse>> getPersonnelCount() {
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getPersonnelCount()));
    }

    @GetMapping("/chart/combo")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get data for combo chart")
    public ResponseEntity<ApiResponse<ComboChartResponse>> getComboChart(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getComboChart(w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/details")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get detailed hierarchical objectives for chart and table with sort, filter and pagination")
    public ResponseEntity<ApiResponse<SubordinateDetailsResponses.PagedObjectiveDetailedResponse>> getDetailedObjectives(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(
                subordinateAnalyticsService.getDetailedObjectives(w.from(), w.to(), onlyApproved, sortBy, sortDir, orgUnitId, page, size)));
    }

    @GetMapping("/details/filter-units")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get available org units for filtering the objective detail table")
    public ResponseEntity<ApiResponse<List<SubordinateDetailsResponses.OrgUnitFilterDto>>> getDetailFilterUnits() {
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getAvailableOrgUnitsForFilter()));
    }

    @GetMapping("/objectives/{id}/metrics")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get scoped metrics for a specific objective")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.ScopedMetrics>> getObjectiveMetrics(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getObjectiveScopedMetrics(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/objectives/{id}/chart/combo")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get combo chart for a specific objective")
    public ResponseEntity<ApiResponse<SubordinateStatsResponses.ComboChartResponse>> getObjectiveComboChart(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getObjectiveScopedComboChart(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/objectives/{id}/top-entities")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get top key results and units for a specific objective")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.TopScopedEntitiesResponse>> getObjectiveTopEntities(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getObjectiveScopedTopEntities(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/key-results/{id}/metrics")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get scoped metrics for a specific key result")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.ScopedMetrics>> getKeyResultMetrics(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKeyResultScopedMetrics(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/key-results/{id}/chart/combo")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get combo chart for a specific key result")
    public ResponseEntity<ApiResponse<SubordinateStatsResponses.ComboChartResponse>> getKeyResultComboChart(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKeyResultScopedComboChart(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/key-results/{id}/top-entities")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get top kpis and units for a specific key result")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.TopScopedEntitiesResponse>> getKeyResultTopEntities(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKeyResultScopedTopEntities(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/kpis/{id}/metrics")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get scoped metrics for a specific KPI")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.ScopedMetrics>> getKpiMetrics(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKpiScopedMetrics(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/kpis/{id}/chart/combo")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get combo chart for a specific KPI")
    public ResponseEntity<ApiResponse<SubordinateStatsResponses.ComboChartResponse>> getKpiComboChart(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKpiScopedComboChart(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/kpis/{id}/top-entities")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get top submissions and users for a specific KPI")
    public ResponseEntity<ApiResponse<ScopedDashboardResponse.TopScopedEntitiesResponse>> getKpiTopEntities(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getKpiScopedTopEntities(id, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/top-entities-dashboard")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW') or hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get top 5 objectives and units dashboard")
    public ResponseEntity<ApiResponse<SubordinateDetailsResponses.TopEntitiesDashboardResponse>> getTopEntitiesDashboard(
            @RequestParam(defaultValue = "BEST") String filter,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId);
        return ResponseEntity.ok(ApiResponse.success(subordinateAnalyticsService.getTopEntitiesDashboard(w.from(), w.to(), filter, onlyApproved)));
    }
}
