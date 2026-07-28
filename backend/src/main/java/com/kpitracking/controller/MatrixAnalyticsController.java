package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.MatrixAnalyticsResponses.*;
import com.kpitracking.service.MatrixAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Thống kê Ma trận xếp loại theo cây đơn vị + kỳ — phục vụ tab "Ma trận đánh giá" ở trang Thống kê.
 * Chữ ký tham số theo cùng mẫu {@code BscAnalyticsController}.
 */
@RestController
@RequestMapping("/api/v1/stats/matrix")
@RequiredArgsConstructor
@Tag(name = "Matrix Analytics", description = "Thống kê ma trận xếp loại hiệu quả (tab Ma trận đánh giá)")
public class MatrixAnalyticsController {

    private final MatrixAnalyticsService service;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Thẻ chỉ số + phân bố xếp loại + heatmap hành vi × %hoàn thành")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getOverview(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

}
