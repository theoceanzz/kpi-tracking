package com.kpitracking.controller;

import com.kpitracking.dto.request.bsc.BscOverrideRequest;
import com.kpitracking.dto.request.bsc.CascadePolicyRequest;
import com.kpitracking.dto.request.bsc.CascadeRequest;
import com.kpitracking.dto.request.bsc.ScorecardStatusRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.bsc.BscKpiPlanResponse;
import com.kpitracking.dto.response.bsc.BscWaterfallResponse;
import com.kpitracking.dto.response.bsc.CascadePolicyResponse;
import com.kpitracking.dto.response.bsc.ScorecardCoverageResponse;
import com.kpitracking.dto.response.bsc.ScorecardTreeNodeResponse;
import com.kpitracking.dto.response.bsc.UnitResultResponse;
import com.kpitracking.service.BscCascadeService;
import com.kpitracking.service.BscKpiPlanService;
import com.kpitracking.service.BscPolicyService;
import com.kpitracking.service.BscResultService;
import com.kpitracking.service.BscService;
import com.kpitracking.service.BscTreeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Cây BSC phân cấp: phân rã chỉ tiêu, độ phủ, vòng đời trình–duyệt, kết quả BSC đơn vị,
 * chính sách điểm BSC và diễn giải điểm cá nhân. Xem docs/bsc-cascade-design.md mục 6.
 *
 * <p>Tách khỏi {@link BscController} (danh mục hạng mục + CRUD bộ tiêu chí) để hai nhóm nghiệp vụ
 * không trộn vào nhau khi cùng phình ra.
 */
@RestController
@RequestMapping("/api/v1/bsc")
@RequiredArgsConstructor
public class BscCascadeController {

    private final BscTreeService treeService;
    private final BscCascadeService cascadeService;
    private final BscResultService resultService;
    private final BscPolicyService policyService;
    private final BscService bscService;
    private final BscKpiPlanService kpiPlanService;

    // ============================================================
    // Cây & độ phủ
    // ============================================================

    /** Cây Công ty → Đơn vị. {@code kpiPeriodId} tuỳ chọn: có thì đính kèm %đạt của từng nhánh. */
    @GetMapping("/organization/{organizationId}/scorecards/tree")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<List<ScorecardTreeNodeResponse>>> tree(
            @PathVariable UUID organizationId,
            @RequestParam(required = false) UUID kpiPeriodId) {
        return ResponseEntity.ok(ApiResponse.success(treeService.tree(organizationId, kpiPeriodId)));
    }

    @GetMapping("/scorecards/{scorecardId}/coverage")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<ScorecardCoverageResponse>> coverage(@PathVariable UUID scorecardId) {
        return ResponseEntity.ok(ApiResponse.success(treeService.coverage(scorecardId)));
    }

    /**
     * Bản kế hoạch chia MỘT chỉ tiêu BSC thành KPI theo từng đợt: mục tiêu của chỉ tiêu, các đợt
     * bộ tiêu chí đang áp dụng, mỗi đợt đã chia được bao nhiêu và còn lại bao nhiêu.
     */
    @GetMapping("/scorecard-perspectives/{itemId}/kpi-plan")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<BscKpiPlanResponse>> kpiPlan(@PathVariable UUID itemId) {
        return ResponseEntity.ok(ApiResponse.success(kpiPlanService.plan(itemId)));
    }

    /**
     * Phân rã một chỉ tiêu xuống nhiều đơn vị. Chỉ người quản trị BSC toàn tổ chức mới giao được
     * việc xuống cấp dưới — trưởng đơn vị chỉ thêm chỉ tiêu của chính đơn vị mình.
     */
    @PostMapping("/scorecards/{scorecardId}/cascade")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<ScorecardCoverageResponse>> cascade(
            @PathVariable UUID scorecardId,
            @Valid @RequestBody CascadeRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã phân rã chỉ tiêu xuống các đơn vị",
                treeService.cascade(scorecardId, request)));
    }

    /**
     * Gắn bộ tiêu chí vào cấp trên (hoặc gỡ khỏi cây khi bỏ trống {@code parentScorecardId}).
     * Cùng mức quyền với phân rã: đây là thao tác định hình cây, không phải sửa nội dung một thẻ.
     */
    @PutMapping("/scorecards/{scorecardId}/parent")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<Object>> attachParent(
            @PathVariable UUID scorecardId,
            @RequestParam(value = "parentScorecardId", required = false) UUID parentScorecardId,
            @RequestParam(value = "linkItems", defaultValue = "true") boolean linkItems) {
        int linked = treeService.attachParent(scorecardId, parentScorecardId, linkItems);
        String message = parentScorecardId == null
                ? "Đã gỡ bộ tiêu chí khỏi cây"
                : linked > 0
                    ? "Đã gắn vào bộ tiêu chí cấp trên và nối " + linked + " chỉ tiêu trùng hạng mục"
                    : "Đã gắn vào bộ tiêu chí cấp trên (không có chỉ tiêu nào trùng hạng mục để nối)";
        return ResponseEntity.ok(ApiResponse.success(message, bscService.getScorecardById(scorecardId)));
    }

    // ============================================================
    // Vòng đời trình – duyệt
    // ============================================================

    /** Trình lên cấp trên. Trưởng đơn vị làm được việc này với BSC của chính đơn vị mình. */
    @PostMapping("/scorecards/{scorecardId}/submit")
    @PreAuthorize("hasAnyAuthority('BSC:MANAGE', 'BSC:MANAGE_UNIT')")
    public ResponseEntity<ApiResponse<Object>> submit(@PathVariable UUID scorecardId) {
        treeService.submit(scorecardId);
        return ResponseEntity.ok(ApiResponse.success("Đã trình bộ tiêu chí, chờ cấp trên duyệt",
                bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/scorecards/{scorecardId}/approve")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ResponseEntity<ApiResponse<Object>> approve(@PathVariable UUID scorecardId) {
        treeService.approve(scorecardId);
        return ResponseEntity.ok(ApiResponse.success("Đã duyệt bộ tiêu chí",
                bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/scorecards/{scorecardId}/reject")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ResponseEntity<ApiResponse<Object>> reject(@PathVariable UUID scorecardId,
                                                      @RequestBody ScorecardStatusRequest request) {
        treeService.reject(scorecardId, request.getReason());
        return ResponseEntity.ok(ApiResponse.success("Đã trả lại bộ tiêu chí cho đơn vị sửa",
                bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/scorecards/{scorecardId}/activate")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ResponseEntity<ApiResponse<Object>> activate(@PathVariable UUID scorecardId) {
        treeService.activate(scorecardId);
        return ResponseEntity.ok(ApiResponse.success("Bộ tiêu chí đã được áp dụng",
                bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/scorecards/{scorecardId}/lock")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ResponseEntity<ApiResponse<Object>> lock(@PathVariable UUID scorecardId) {
        treeService.lock(scorecardId);
        return ResponseEntity.ok(ApiResponse.success("Đã khoá bộ tiêu chí",
                bscService.getScorecardById(scorecardId)));
    }

    @PostMapping("/scorecards/{scorecardId}/reopen")
    @PreAuthorize("hasAuthority('BSC:APPROVE')")
    public ResponseEntity<ApiResponse<Object>> reopen(@PathVariable UUID scorecardId) {
        treeService.reopen(scorecardId);
        return ResponseEntity.ok(ApiResponse.success("Đã mở khoá bộ tiêu chí",
                bscService.getScorecardById(scorecardId)));
    }

    // ============================================================
    // Kết quả BSC đơn vị
    // ============================================================

    /** Kết quả đã tính của một đợt. Trả 200 với data = null khi chưa tính lần nào. */
    @GetMapping("/scorecards/{scorecardId}/results")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<UnitResultResponse>> result(
            @PathVariable UUID scorecardId,
            @RequestParam UUID kpiPeriodId) {
        return ResponseEntity.ok(ApiResponse.success(
                cascadeService.findResult(scorecardId, kpiPeriodId)
                        .map(resultService::toResponse)
                        .orElse(null)));
    }

    /**
     * Tính lại kết quả BSC của đơn vị cho một đợt. Trưởng đơn vị tự chạy được cho đơn vị mình —
     * đây là thao tác đọc-tính-ghi trên dữ liệu của chính họ, không đụng tới đơn vị khác.
     */
    @PostMapping("/scorecards/{scorecardId}/results/recompute")
    @PreAuthorize("hasAnyAuthority('BSC:MANAGE', 'BSC:MANAGE_UNIT')")
    public ResponseEntity<ApiResponse<UnitResultResponse>> recompute(
            @PathVariable UUID scorecardId,
            @RequestParam UUID kpiPeriodId) {
        var result = cascadeService.recompute(scorecardId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success("Đã tính lại kết quả BSC của đơn vị",
                resultService.toResponse(result)));
    }

    /** Chốt kết quả BSC của đơn vị — từ đây con số đã công bố không đổi nữa. */
    @PostMapping("/scorecards/{scorecardId}/results/finalize")
    @PreAuthorize("hasAuthority('BSC:PUBLISH_SCORE')")
    public ResponseEntity<ApiResponse<UnitResultResponse>> finalizeResult(
            @PathVariable UUID scorecardId,
            @RequestParam UUID kpiPeriodId) {
        var result = cascadeService.finalizeResult(scorecardId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success("Đã chốt kết quả BSC của đơn vị",
                resultService.toResponse(result)));
    }

    @PostMapping("/scorecards/{scorecardId}/results/reopen")
    @PreAuthorize("hasAuthority('BSC:PUBLISH_SCORE')")
    public ResponseEntity<ApiResponse<UnitResultResponse>> reopenResult(
            @PathVariable UUID scorecardId,
            @RequestParam UUID kpiPeriodId) {
        var result = cascadeService.reopenResult(scorecardId, kpiPeriodId);
        return ResponseEntity.ok(ApiResponse.success("Đã mở khoá kết quả để tính lại",
                resultService.toResponse(result)));
    }

    /** Nhập tay kết quả thực đạt cho một chỉ tiêu lấy số liệu thủ công. */
    @PutMapping("/scorecards/{scorecardId}/results/items/{itemId}")
    @PreAuthorize("hasAnyAuthority('BSC:MANAGE', 'BSC:MANAGE_UNIT')")
    public ResponseEntity<ApiResponse<UnitResultResponse>> setManualActual(
            @PathVariable UUID scorecardId,
            @PathVariable UUID itemId,
            @RequestParam UUID kpiPeriodId,
            @RequestParam(required = false) Double actualValue) {
        var result = cascadeService.setManualActual(scorecardId, kpiPeriodId, itemId, actualValue);
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật số liệu", resultService.toResponse(result)));
    }

    // ============================================================
    // Chính sách điểm BSC
    // ============================================================

    @GetMapping("/organization/{organizationId}/cascade-policies")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<List<CascadePolicyResponse>>> policies(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(policyService.list(organizationId)));
    }

    @PostMapping("/organization/{organizationId}/cascade-policies")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<CascadePolicyResponse>> createPolicy(
            @PathVariable UUID organizationId,
            @Valid @RequestBody CascadePolicyRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo chính sách điểm BSC",
                policyService.create(organizationId, request)));
    }

    @PutMapping("/cascade-policies/{policyId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<CascadePolicyResponse>> updatePolicy(
            @PathVariable UUID policyId,
            @Valid @RequestBody CascadePolicyRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật chính sách điểm BSC",
                policyService.update(policyId, request)));
    }

    @DeleteMapping("/cascade-policies/{policyId}")
    @PreAuthorize("hasAuthority('BSC:MANAGE')")
    public ResponseEntity<ApiResponse<Void>> deletePolicy(@PathVariable UUID policyId) {
        policyService.delete(policyId);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá chính sách điểm BSC"));
    }

    // ============================================================
    // Diễn giải điểm cá nhân
    // ============================================================

    /** Waterfall: điểm gốc → cap → điểm công nhận → ghi đè → chặn. */
    @GetMapping("/evaluations/{evaluationId}/waterfall")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<BscWaterfallResponse>> waterfall(@PathVariable UUID evaluationId) {
        return ResponseEntity.ok(ApiResponse.success(resultService.waterfall(evaluationId)));
    }

    /** Ghi đè điểm công nhận. Lý do bắt buộc — xem QĐ-6. */
    @PostMapping("/evaluations/{evaluationId}/override")
    @PreAuthorize("hasAuthority('BSC:OVERRIDE_SCORE')")
    public ResponseEntity<ApiResponse<BscWaterfallResponse>> override(
            @PathVariable UUID evaluationId,
            @RequestBody BscOverrideRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật điểm ghi đè",
                resultService.override(evaluationId, request)));
    }

    /** Tỉ lệ trọng số KPI liên kết BSC của một người trong một đợt (QĐ-8). */
    @GetMapping("/users/{userId}/linked-weight")
    @PreAuthorize("hasAuthority('BSC:VIEW')")
    public ResponseEntity<ApiResponse<BscCascadeService.LinkedWeightCheck>> linkedWeight(
            @PathVariable UUID userId,
            @RequestParam UUID kpiPeriodId,
            @RequestParam UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(
                cascadeService.checkLinkedWeight(userId, kpiPeriodId, organizationId)));
    }
}
