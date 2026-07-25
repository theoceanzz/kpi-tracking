package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.BscAnalyticsResponses.*;
import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Thống kê BSC scope theo cây đơn vị + kỳ — phục vụ tab "Viễn cảnh (BSC)" ở trang Thống kê.
 * Chữ ký tham số theo cùng mẫu {@code OrgUnitKpiAnalyticsController}: dùng {@code AnalyticsPeriodHelper}
 * để giải nghĩa lựa chọn kỳ (một đợt / khoảng đợt) và xác thực đợt thuộc tổ chức của người dùng.
 */
@RestController
@RequestMapping("/api/v1/stats/bsc")
@RequiredArgsConstructor
@Tag(name = "BSC Analytics", description = "Thống kê BSC theo viễn cảnh (tab Viễn cảnh)")
public class BscAnalyticsController {

    private final BscAnalyticsService service;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/balance")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Cân bằng viễn cảnh: thẻ chỉ số + radar theo phạm vi/kỳ")
    public ResponseEntity<ApiResponse<BalanceResponse>> getBalance(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getBalance(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/trend")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Xu hướng điểm viễn cảnh theo kỳ (mỗi viễn cảnh một series)")
    public ResponseEntity<ApiResponse<TrendResponse>> getTrend(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false, defaultValue = "PERIOD") String groupBy) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getTrend(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo), groupBy)));
    }

    @GetMapping("/unit-comparison")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "So sánh viễn cảnh giữa các đơn vị")
    public ResponseEntity<ApiResponse<UnitComparisonResponse>> getUnitComparison(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getUnitComparison(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/bsc-vs-system")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Đối chiếu điểm BSC vs điểm hệ thống (kiểm chứng SHADOW)")
    public ResponseEntity<ApiResponse<BscVsSystemResponse>> getBscVsSystem(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false, defaultValue = "UNIT") String level) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getBscVsSystem(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo), level)));
    }

    @GetMapping("/rankings")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Xếp hạng nhân sự theo điểm BSC + breakdown viễn cảnh")
    public ResponseEntity<ApiResponse<RankingResponse>> getRankings(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false, defaultValue = "bscScore") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                service.getRankings(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo),
                        sortBy, sortDir, page, size)));
    }
}
