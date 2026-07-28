package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.UnitClassificationResponses.*;
import com.kpitracking.service.UnitClassificationService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Xếp loại đơn vị theo phân bố % xếp loại thành viên (tab Phân cấp). Chữ ký tham số theo cùng mẫu
 * {@code BscAnalyticsController} / {@code MatrixAnalyticsController}.
 */
@RestController
@RequestMapping("/api/v1/stats/unit-classification")
@RequiredArgsConstructor
@Tag(name = "Unit Classification", description = "Xếp loại đơn vị theo phân bố % xếp loại thành viên")
public class UnitClassificationController {

    private final UnitClassificationService service;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('DASHBOARD:VIEW')")
    @Operation(summary = "Phân bố + xếp loại đơn vị + xu hướng %/mức theo kỳ + xếp loại đơn vị con")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getOverview(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }
}
