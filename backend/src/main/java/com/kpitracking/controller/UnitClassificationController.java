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
    @Operation(summary = "Phân bố + xếp loại đơn vị + xu hướng %/mức + xếp loại đơn vị con",
            description = "Có cycleId → xếp loại theo KỲ (dựa trên số chốt kỳ của thành viên); "
                    + "không có → xếp loại theo ĐỢT gần nhất trong phạm vi lọc.")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false) UUID cycleId) {
        OverviewResponse body = cycleId != null
                ? service.getCycleOverview(orgUnitId, cycleId)
                : service.getOverview(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo));
        return ResponseEntity.ok(ApiResponse.success(body));
    }
}
