package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.stats.OrgUnitKpiStatsResponse;
import com.kpitracking.dto.response.stats.EmployeeKpiStatsResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
import com.kpitracking.dto.response.stats.AnalyticsMyStatsResponse;
import com.kpitracking.dto.response.stats.AnalyticsDrillDownResponse;
import com.kpitracking.dto.response.stats.AnalyticsDetailRow;
import com.kpitracking.dto.response.stats.AnalyticsSummaryResponse;
import com.kpitracking.dto.response.stats.SummarySubData;
import com.kpitracking.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.kpitracking.dto.response.stats.ExportDetailedPerformanceResponse;

@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
@Tag(name = "Statistics", description = "Dashboard statistics endpoints")
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/detailed-export")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get detailed statistics for Excel export")
    public ResponseEntity<ApiResponse<List<ExportDetailedPerformanceResponse>>> getDetailedExportStats(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam UUID kpiPeriodId) {
        List<ExportDetailedPerformanceResponse> response = statsService.getDetailedExportStats(orgUnitId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get organization overview statistics")
    public ResponseEntity<ApiResponse<OverviewStatsResponse>> getOverviewStats(
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.util.UUID orgUnitId) {
        OverviewStatsResponse response = statsService.getOverviewStats(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/org-units")
    @PreAuthorize("hasAuthority('ORG:VIEW')")
    @Operation(summary = "Get KPI statistics by org unit")
    public ResponseEntity<ApiResponse<List<OrgUnitKpiStatsResponse>>> getOrgUnitKpiStats() {
        List<OrgUnitKpiStatsResponse> response = statsService.getOrgUnitKpiStats();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAnyAuthority('USER:VIEW', 'USER:VIEW_LIST')")
    @Operation(summary = "Get KPI statistics per employee")
    public ResponseEntity<ApiResponse<PageResponse<EmployeeKpiStatsResponse>>> getEmployeeKpiStats(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "5") int size,
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.util.UUID orgUnitId) {
        PageResponse<EmployeeKpiStatsResponse> response = statsService.getEmployeeKpiStats(page, size, orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-progress")
    @Operation(summary = "Get current user's KPI progress")
    public ResponseEntity<ApiResponse<MyKpiProgressResponse>> getMyKpiProgress(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "5") int size) {
        MyKpiProgressResponse response = statsService.getMyKpiProgress(page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/employee-progress/{userId}")
    @PreAuthorize("hasAnyAuthority('USER:VIEW', 'USER:VIEW_LIST')")
    @Operation(summary = "Get a specific employee's KPI progress")
    public ResponseEntity<ApiResponse<MyKpiProgressResponse>> getEmployeeKpiProgress(
            @org.springframework.web.bind.annotation.PathVariable java.util.UUID userId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "5") int size) {
        MyKpiProgressResponse response = statsService.getUserKpiProgress(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ============================================================
    // ANALYTICS ENDPOINTS
    // ============================================================

    @GetMapping("/my-analytics")
    @Operation(summary = "Get current user's detailed analytics")
    public ResponseEntity<ApiResponse<AnalyticsMyStatsResponse>> getMyAnalytics(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to) {
        AnalyticsMyStatsResponse response = statsService.getMyAnalytics(from, to);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/drill-down")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get drill-down analytics by org unit hierarchy")
    public ResponseEntity<ApiResponse<AnalyticsDrillDownResponse>> getDrillDown(
            @RequestParam(required = false) UUID orgUnitId) {
        AnalyticsDrillDownResponse response = statsService.getDrillDown(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/detail-table")
    @PreAuthorize("hasAuthority('ORG:VIEW')")
    @Operation(summary = "Get detailed analytics table with sorting and filtering")
    public ResponseEntity<ApiResponse<PageResponse<AnalyticsDetailRow>>> getDetailTable(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageResponse<AnalyticsDetailRow> response = statsService.getDetailTable(orgUnitId, search, page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Get overall summary analytics (Initial load)")
    public ResponseEntity<ApiResponse<AnalyticsSummaryResponse>> getSummary(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID rankingUnitId,
            @RequestParam(defaultValue = "DESC") String direction) {
        AnalyticsSummaryResponse response = statsService.getSummary(orgUnitId, rankingUnitId, direction);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/summary/trend")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    public ResponseEntity<ApiResponse<List<AnalyticsSummaryResponse.TrendPoint>>> getTrend(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(defaultValue = "5_MONTHS") String period) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getTrend(orgUnitId, period)));
    }

    @GetMapping("/summary/unit-comparison")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    public ResponseEntity<ApiResponse<SummarySubData.UnitComparisonData>> getUnitComparison(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(defaultValue = "MONTH") String period) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getUnitComparison(orgUnitId, period)));
    }

    @GetMapping("/summary/risks")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    public ResponseEntity<ApiResponse<SummarySubData.RiskData>> getRisks(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(defaultValue = "MONTH") String period) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getRisks(orgUnitId, period)));
    }

    @GetMapping("/summary/rankings")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    public ResponseEntity<ApiResponse<SummarySubData.RankingData>> getRankings(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID rankingUnitId,
            @RequestParam(defaultValue = "MONTH") String period) {
        return ResponseEntity.ok(ApiResponse.success(statsService.getRankings(orgUnitId, rankingUnitId, period)));
    }
}

