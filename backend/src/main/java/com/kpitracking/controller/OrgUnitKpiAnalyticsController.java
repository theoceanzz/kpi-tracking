package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.service.OrgUnitKpiAnalyticsService;
import com.kpitracking.service.OrgUnitKpiAnalyticsService.*;
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
@RequestMapping("/api/v1/stats/org-unit/kpis")
@RequiredArgsConstructor
@Tag(name = "Org Unit KPI Analytics", description = "Org-unit scoped standalone KPI analytics (KPI đơn vị)")
public class OrgUnitKpiAnalyticsController {

    private final OrgUnitKpiAnalyticsService service;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/metrics")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Metrics for standalone KPIs in org unit subtree")
    public ResponseEntity<ApiResponse<Metrics>> getMetrics(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getMetrics(orgUnitId, w.from(), w.to(), onlyApproved, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/chart/combo")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Combo chart for standalone KPIs in org unit subtree")
    public ResponseEntity<ApiResponse<ComboChartData>> getComboChart(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false, defaultValue = "TIME") String groupBy) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getComboChart(orgUnitId, w.from(), w.to(), onlyApproved, periodHelper.resolvePeriodIds(periodId, periodIdTo), groupBy)));
    }

    @GetMapping("/details")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Paged detail table for standalone KPIs in org unit subtree")
    public ResponseEntity<ApiResponse<OrgUnitKpiPagedResponse>> getDetailedKpis(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID filterOrgUnitId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String sharedType,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getDetailedKpis(orgUnitId, filterOrgUnitId, w.from(), w.to(), onlyApproved,
                        sortBy, sortDir, sharedType, page, size, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/risks/units")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Unit risk table: overdue rate and avg progress")
    public ResponseEntity<ApiResponse<OrgUnitKpiAnalyticsService.UnitRiskPagedResponse>> getUnitRisks(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "5") int size,
            @RequestParam(required = false, defaultValue = "progress") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getUnitRisks(orgUnitId, w.from(), w.to(), onlyApproved, page, size, sortBy, sortDir, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/risks/members")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Member risk table: overdue rate and avg progress")
    public ResponseEntity<ApiResponse<OrgUnitKpiAnalyticsService.MemberRiskPagedResponse>> getMemberRisks(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID filterOrgUnitId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "5") int size,
            @RequestParam(required = false, defaultValue = "progress") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getMemberRisks(orgUnitId, filterOrgUnitId, w.from(), w.to(), onlyApproved, page, size, sortBy, sortDir, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/{kpiId}/drawer")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "Drawer detail data for a standalone KPI")
    public ResponseEntity<ApiResponse<OrgUnitKpiDrawerData>> getKpiDrawerData(
            @PathVariable UUID kpiId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                service.getKpiDrawerData(kpiId, w.from(), w.to(), onlyApproved)));
    }

    @GetMapping("/risks/units/{unitId}/overdue-kpis")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "List of overdue KPIs for a specific org unit")
    public ResponseEntity<ApiResponse<List<OrgUnitKpiAnalyticsService.OverdueKpiForUnit>>> getUnitOverdueKpis(
            @PathVariable UUID unitId) {
        return ResponseEntity.ok(ApiResponse.success(service.getUnitOverdueKpis(unitId)));
    }

    @GetMapping("/risks/members/{userId}/overdue-kpis")
    @PreAuthorize("hasAuthority('KPI:VIEW')")
    @Operation(summary = "List of overdue KPIs for a specific member")
    public ResponseEntity<ApiResponse<List<OrgUnitKpiAnalyticsService.OverdueKpiForMember>>> getMemberOverdueKpis(
            @PathVariable UUID userId,
            @RequestParam(required = false) UUID orgUnitId) {
        return ResponseEntity.ok(ApiResponse.success(service.getMemberOverdueKpis(userId, orgUnitId)));
    }
}
