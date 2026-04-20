package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.OrgUnitKpiStatsResponse;
import com.kpitracking.dto.response.stats.EmployeeKpiStatsResponse;
import com.kpitracking.dto.response.stats.MyKpiProgressResponse;
import com.kpitracking.dto.response.stats.OverviewStatsResponse;
import com.kpitracking.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
@Tag(name = "Statistics", description = "Dashboard statistics endpoints")
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Get organization overview statistics")
    public ResponseEntity<ApiResponse<OverviewStatsResponse>> getOverviewStats() {
        OverviewStatsResponse response = statsService.getOverviewStats();
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
    @PreAuthorize("hasAuthority('USER:VIEW')")
    @Operation(summary = "Get KPI statistics per employee")
    public ResponseEntity<ApiResponse<List<EmployeeKpiStatsResponse>>> getEmployeeKpiStats() {
        List<EmployeeKpiStatsResponse> response = statsService.getEmployeeKpiStats();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-progress")
    @Operation(summary = "Get current user's KPI progress")
    public ResponseEntity<ApiResponse<MyKpiProgressResponse>> getMyKpiProgress() {
        MyKpiProgressResponse response = statsService.getMyKpiProgress();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
