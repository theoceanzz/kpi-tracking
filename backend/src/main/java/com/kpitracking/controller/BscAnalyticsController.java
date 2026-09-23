package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.stats.BscAnalyticsResponses.RankingResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.AttainmentTrendResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.ItemAttainmentResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.OverviewResponse;
import com.kpitracking.dto.response.stats.BscOverviewResponses.UnitAttainmentRow;
import com.kpitracking.service.BscAnalyticsService;
import com.kpitracking.service.BscOverviewService;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Thống kê BSC cho tab "Hạng mục BSC" ở trang Thống kê.
 *
 * <p>Các ô tổng quan đọc mô hình THẺ ĐIỂM (cây công ty → đơn vị, kết quả đợt, phân rã, hạng mục
 * chặn). Tham số cùng mẫu với {@code OrgUnitKpiAnalyticsController}: {@code orgUnitId} thu phạm vi
 * về một đơn vị, {@code periodId}/{@code periodIdTo} chọn một đợt hay khoảng đợt (ô "một đợt" lấy
 * đợt muộn nhất có kết quả trong khoảng đó).
 */
@RestController
@RequestMapping("/api/v1/stats/bsc")
@RequiredArgsConstructor
@Tag(name = "BSC Analytics", description = "Thống kê BSC theo thẻ điểm (tab Hạng mục BSC)")
public class BscAnalyticsController {

    private final BscAnalyticsService service;
    private final BscOverviewService overviewService;
    private final AnalyticsPeriodHelper periodHelper;

    @GetMapping("/overview")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Sức khoẻ BSC của đợt: %đạt thẻ gốc, thẻ đơn vị theo trạng thái, hạng mục chặn, độ phủ phân rã")
    public ResponseEntity<ApiResponse<OverviewResponse>> getOverview(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                overviewService.overview(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/unit-attainment")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Cây thẻ điểm trải phẳng kèm %đạt và kết quả hạng mục chặn của đợt")
    public ResponseEntity<ApiResponse<List<UnitAttainmentRow>>> getUnitAttainment(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                overviewService.unitAttainment(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/item-attainment")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Mức đạt từng chỉ tiêu của thẻ gốc trong đợt: thực tế / mục tiêu / sàn / trọng số / chặn")
    public ResponseEntity<ApiResponse<ItemAttainmentResponse>> getItemAttainment(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                overviewService.itemAttainment(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/attainment-trend")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "%đạt BSC của thẻ gốc qua các đợt, kèm %đạt theo 4 lĩnh vực")
    public ResponseEntity<ApiResponse<AttainmentTrendResponse>> getAttainmentTrend(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                overviewService.attainmentTrend(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/cascade-coverage")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Độ phủ phân rã các chỉ tiêu của thẻ gốc xuống đơn vị")
    public ResponseEntity<ApiResponse<ScorecardCoverageResponse>> getCascadeCoverage(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                overviewService.cascadeCoverage(orgUnitId, periodHelper.resolvePeriodIds(periodId, periodIdTo))));
    }

    @GetMapping("/rankings")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Xếp hạng nhân sự theo điểm BSC + breakdown lĩnh vực")
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
