package com.kpitracking.controller;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.stats.advanced.CompositionResponses.*;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.BehaviorCompletionResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.BscVsSystemScatterResponse;
import com.kpitracking.dto.response.stats.advanced.CorrelationResponses.PerspectiveBubbleResponse;
import com.kpitracking.dto.response.stats.advanced.DistributionResponses.*;
import com.kpitracking.dto.response.stats.advanced.FlowResponses.SankeyResponse;
import com.kpitracking.dto.response.stats.advanced.RankingResponses.*;
import com.kpitracking.service.analytics.AnalyticsPeriodHelper;
import com.kpitracking.service.analytics.CompositionAnalyticsService;
import com.kpitracking.service.analytics.CorrelationAnalyticsService;
import com.kpitracking.service.analytics.DistributionAnalyticsService;
import com.kpitracking.service.analytics.FlowAnalyticsService;
import com.kpitracking.service.analytics.RankingAnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

/**
 * Biểu đồ chuyên sâu cho trang Thống kê.
 *
 * <p>Gác quyền hai tầng:
 * <ol>
 *   <li>{@code @PreAuthorize} chỉ mở cổng cho người có ít nhất một quyền thống kê.</li>
 *   <li>{@code StatsTierResolver} trong service quyết định người đó thấy được DỮ LIỆU nào
 *       (toàn tổ chức / cây đơn vị của mình / chỉ mình).</li>
 * </ol>
 * Bỏ tầng thứ hai là mất sạch phân cấp, vì authority nạp bởi {@code CustomUserDetailsService}
 * được gộp phẳng, không mang theo thông tin đơn vị.
 */
@RestController
@RequestMapping("/api/v1/stats/advanced")
@RequiredArgsConstructor
@Tag(name = "Advanced Analytics", description = "Biểu đồ chuyên sâu theo ba cấp vai trò")
public class AdvancedAnalyticsController {

    private static final String ANY_STATS_PERMISSION =
            "hasAnyAuthority('STATS:VIEW_ORG','STATS:VIEW_EMPLOYEE','STATS:VIEW_MY')";

    private final CorrelationAnalyticsService correlationService;
    private final DistributionAnalyticsService distributionService;
    private final CompositionAnalyticsService compositionService;
    private final FlowAnalyticsService flowService;
    private final RankingAnalyticsService rankingService;
    private final AnalyticsPeriodHelper periodHelper;

    // ============================================================
    // Tương quan
    // ============================================================

    @GetMapping("/correlation/behavior-completion")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Phân tán điểm hành vi × % hoàn thành KPI (mỗi chấm một người)")
    public ResponseEntity<ApiResponse<BehaviorCompletionResponse>> behaviorCompletion(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                correlationService.getBehaviorCompletion(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/correlation/bsc-vs-system")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Phân tán điểm BSC vs điểm hệ thống, kèm đường chuẩn y=x")
    public ResponseEntity<ApiResponse<BscVsSystemScatterResponse>> bscVsSystem(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                correlationService.getBscVsSystem(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/correlation/perspective-bubble")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Bong bóng hạng mục BSC: trọng số × điểm đạt × số KPI")
    public ResponseEntity<ApiResponse<PerspectiveBubbleResponse>> perspectiveBubble(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                correlationService.getPerspectiveBubble(orgUnitId, periods(periodId, periodIdTo))));
    }

    // ============================================================
    // Phân phối
    // ============================================================

    @GetMapping("/distribution/score-histogram")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Histogram phân phối điểm đánh giá kèm vạch ngưỡng xếp loại")
    public ResponseEntity<ApiResponse<ScoreHistogramResponse>> scoreHistogram(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                distributionService.getScoreHistogram(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/distribution/unit-boxplot")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Hộp phân tán điểm theo đơn vị (min–Q1–trung vị–Q3–max)")
    public ResponseEntity<ApiResponse<UnitBoxplotResponse>> unitBoxplot(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                distributionService.getUnitBoxplot(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/distribution/headcount-pyramid")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Tháp cơ cấu nhân sự theo cấp và chức vụ")
    public ResponseEntity<ApiResponse<HeadcountPyramidResponse>> headcountPyramid(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                distributionService.getHeadcountPyramid(orgUnitId, periods(periodId, periodIdTo))));
    }

    // ============================================================
    // Thành phần & thời gian
    // ============================================================

    @GetMapping("/timeline/submission-composition")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Cơ cấu bài nộp theo tháng (vùng chồng)")
    public ResponseEntity<ApiResponse<SubmissionCompositionResponse>> submissionComposition(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        AnalyticsPeriodHelper.Window w = periodHelper.window(from, to, periodId, periodIdTo);
        return ResponseEntity.ok(ApiResponse.success(
                compositionService.getSubmissionComposition(
                        orgUnitId, periods(periodId, periodIdTo), w.from(), w.to())));
    }

    @GetMapping("/part/submission-share")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Cơ cấu trạng thái bài nộp theo đơn vị, chuẩn hoá 100%")
    public ResponseEntity<ApiResponse<SubmissionShareResponse>> submissionShare(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                compositionService.getSubmissionShare(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/part/bsc-waterfall")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Thác nước cấu thành điểm BSC theo từng hạng mục")
    public ResponseEntity<ApiResponse<BscWaterfallResponse>> bscWaterfall(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                compositionService.getBscWaterfall(orgUnitId, periods(periodId, periodIdTo))));
    }

    /** Lịch sử trọng số là cấu hình cấp tổ chức nên gác thêm quyền quản trị BSC. */
    @GetMapping("/timeline/bsc-weight-history")
    @PreAuthorize(ANY_STATS_PERMISSION + " and hasAuthority('BSC:MANAGE')")
    @Operation(summary = "Đường bậc thang lịch sử thay đổi trọng số hạng mục BSC")
    public ResponseEntity<ApiResponse<WeightHistoryResponse>> weightHistory(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                compositionService.getWeightHistory(orgUnitId, periods(periodId, periodIdTo))));
    }

    // ============================================================
    // Luồng
    // ============================================================

    @GetMapping("/flow/kpi-cascade")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Sankey phân rã / uỷ quyền KPI theo cây đơn vị")
    public ResponseEntity<ApiResponse<SankeyResponse>> kpiCascade(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                flowService.getKpiCascade(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/flow/kpi-lifecycle")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Sankey vòng đời KPI: nháp → duyệt → hiệu lực / bị thay thế")
    public ResponseEntity<ApiResponse<SankeyResponse>> kpiLifecycle(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                flowService.getKpiLifecycle(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/flow/okr")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Sankey OKR: Mục tiêu → Key Result → Đơn vị")
    public ResponseEntity<ApiResponse<SankeyResponse>> okrFlow(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                flowService.getOkrFlow(orgUnitId, periods(periodId, periodIdTo))));
    }

    // ============================================================
    // Xếp hạng & so sánh
    // ============================================================

    @GetMapping("/comparison/deviation")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Biểu đồ phân kỳ: chênh lệch điểm so với trung bình")
    public ResponseEntity<ApiResponse<DeviationResponse>> deviation(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                rankingService.getScoreDeviation(orgUnitId, periods(periodId, periodIdTo))));
    }

    @GetMapping("/comparison/self-vs-manager")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Cột nhóm: điểm tự đánh giá vs điểm quản lý đánh giá theo đơn vị")
    public ResponseEntity<ApiResponse<SelfVsManagerResponse>> selfVsManager(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo,
            @RequestParam(required = false) UUID cycleId) {
        return ResponseEntity.ok(ApiResponse.success(
                rankingService.getSelfVsManager(orgUnitId, periods(periodId, periodIdTo), cycleId)));
    }

    @GetMapping("/ranking/rank-delta")
    @PreAuthorize(ANY_STATS_PERMISSION)
    @Operation(summary = "Biến động thứ hạng đơn vị giữa hai kỳ gần nhất")
    public ResponseEntity<ApiResponse<RankDeltaResponse>> rankDelta(
            @RequestParam(required = false) UUID orgUnitId,
            @RequestParam(required = false) UUID periodId,
            @RequestParam(required = false) UUID periodIdTo) {
        return ResponseEntity.ok(ApiResponse.success(
                rankingService.getRankDelta(orgUnitId, periods(periodId, periodIdTo))));
    }

    // ============================================================

    private java.util.List<UUID> periods(UUID periodId, UUID periodIdTo) {
        return periodHelper.resolvePeriodIds(periodId, periodIdTo);
    }
}
