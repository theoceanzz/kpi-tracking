package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.PersonalObjectiveResponses.*;
import com.kpitracking.service.PersonalObjectiveAnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/stats/personal/objectives")
@RequiredArgsConstructor
@Tag(name = "Personal Objective Analytics", description = "Personal objective dashboard endpoints")
public class PersonalObjectiveAnalyticsController {

    private final PersonalObjectiveAnalyticsService personalObjectiveAnalyticsService;

    @GetMapping("/metrics")
    @Operation(summary = "Get personal objective metrics")
    public ResponseEntity<ApiResponse<Metrics>> getMetrics(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getMetrics(from, to, onlyApproved)));
    }

    @GetMapping("/chart/combo")
    @Operation(summary = "Get data for personal combo chart")
    public ResponseEntity<ApiResponse<ComboChartData>> getComboChart(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getComboChart(from, to, onlyApproved)));
    }

    @GetMapping("/details")
    @Operation(summary = "Get detailed personal KPIs for table")
    public ResponseEntity<ApiResponse<List<KpiDetail>>> getDetailedKpis(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getDetailedKpis(from, to, onlyApproved)));
    }

    @GetMapping("/kpis/{id}/drawer")
    @Operation(summary = "Get scoped metrics and chart data for a specific KPI drawer")
    public ResponseEntity<ApiResponse<DrawerData>> getKpiDrawerData(
            @PathVariable UUID id,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyApproved) {
        return ResponseEntity.ok(ApiResponse.success(personalObjectiveAnalyticsService.getKpiDrawerData(id, from, to, onlyApproved)));
    }
}
