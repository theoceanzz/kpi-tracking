package com.kpitracking.controller;

import com.kpitracking.dto.request.kpi.approval.ApproveKpiRequest;
import com.kpitracking.dto.request.kpi.approval.BulkApproveKpiRequest;
import com.kpitracking.dto.request.kpi.approval.ReassignApprovalStepRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.approval.BulkApproveResultResponse;
import com.kpitracking.dto.response.kpi.approval.KpiApprovalChainResponse;
import com.kpitracking.entity.User;
import com.kpitracking.enums.ApprovalOutcome;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.kpi.approval.KpiApprovalChainService;
import com.kpitracking.service.kpi.approval.KpiApprovalViewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Chuỗi duyệt KPI theo phân cấp: hộp "chờ tôi duyệt", stepper + lịch sử, duyệt hàng loạt và gán
 * lại người duyệt. Duyệt / từ chối từng chỉ tiêu vẫn ở {@code /api/v1/kpi-criteria/{id}/approve|reject}.
 *
 * <p>Quyền thao tác trên chuỗi là "đang giữ bước hiện tại", do service kiểm cho từng KPI — nên các
 * endpoint ở đây chỉ đòi đăng nhập.
 */
@RestController
@RequestMapping("/api/v1/kpi-approvals")
@RequiredArgsConstructor
@Tag(name = "KPI Approval Chain", description = "Chuỗi duyệt KPI theo phân cấp và quyền duyệt cuối")
public class KpiApprovalController {

    private final KpiApprovalViewService viewService;
    private final KpiApprovalChainService chainService;
    private final KpiCriteriaService kpiCriteriaService;

    @GetMapping("/inbox")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chỉ tiêu đang chờ ĐÚNG người gọi duyệt ở bước hiện tại")
    public ResponseEntity<ApiResponse<List<KpiCriteriaResponse>>> inbox(
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) UUID orgUnitId) {
        User me = viewService.currentUser();
        return ResponseEntity.ok(ApiResponse.success(viewService.criteriaInbox(me.getId(), kpiPeriodId, orgUnitId)));
    }

    @GetMapping("/inbox/count")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Long>>> inboxCount() {
        User me = viewService.currentUser();
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "criteria", viewService.inboxCount(me.getId(), ApprovalSubjectType.CRITERIA),
                "adjustments", viewService.inboxCount(me.getId(), ApprovalSubjectType.ADJUSTMENT))));
    }

    @GetMapping("/kpi/{kpiId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chuỗi duyệt (stepper) và lịch sử duyệt của một KPI")
    public ResponseEntity<ApiResponse<KpiApprovalChainResponse>> chain(@PathVariable UUID kpiId) {
        User me = viewService.currentUser();
        return ResponseEntity.ok(ApiResponse.success(viewService.chainOf(kpiId, me.getId())));
    }

    /**
     * Duyệt hàng loạt: mỗi KPI một transaction riêng và đi đúng chuỗi của nó — cái thì chốt, cái thì
     * chuyển lên; KPI lỗi (không giữ bước, bước đã đổi, kỳ đã khoá…) không kéo cả lô.
     */
    @PostMapping("/bulk-approve")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Duyệt hàng loạt chỉ tiêu, kết quả từng dòng")
    public ResponseEntity<ApiResponse<List<BulkApproveResultResponse>>> bulkApprove(
            @Valid @RequestBody BulkApproveKpiRequest request) {
        List<BulkApproveResultResponse> results = new ArrayList<>();
        for (BulkApproveKpiRequest.Item item : request.getItems()) {
            try {
                KpiCriteriaService.ApproveResult r = kpiCriteriaService.approveKpiWithOutcome(item.getKpiId(),
                        ApproveKpiRequest.builder().expectedStepId(item.getExpectedStepId()).comment(request.getComment()).build());
                results.add(BulkApproveResultResponse.builder()
                        .kpiId(item.getKpiId())
                        .kpiName(r.response().getName())
                        .success(true)
                        .outcome(r.outcome())
                        .nextHolderNames(r.nextHolderNames())
                        .message(r.outcome() == ApprovalOutcome.FORWARDED
                                ? "Đã chuyển lên " + (r.nextHolderNames() == null ? "cấp trên" : r.nextHolderNames())
                                : "Đã duyệt cuối")
                        .build());
            } catch (BusinessException | ForbiddenException | com.kpitracking.exception.ResourceNotFoundException
                     | org.springframework.orm.ObjectOptimisticLockingFailureException e) {
                results.add(BulkApproveResultResponse.builder()
                        .kpiId(item.getKpiId()).success(false).message(e.getMessage()).build());
            }
        }
        long ok = results.stream().filter(BulkApproveResultResponse::isSuccess).count();
        return ResponseEntity.ok(ApiResponse.success("Đã xử lý " + ok + "/" + results.size() + " chỉ tiêu", results));
    }

    @PostMapping("/steps/{stepId}/reassign")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Admin gán lại người duyệt của bước đang chờ")
    public ResponseEntity<ApiResponse<KpiApprovalChainResponse>> reassign(
            @PathVariable UUID stepId,
            @Valid @RequestBody ReassignApprovalStepRequest request) {
        User me = viewService.currentUser();
        UUID kpiId = chainService.reassign(stepId, me, request.getApproverId(), request.getReason())
                .getKpiCriteria().getId();
        return ResponseEntity.ok(ApiResponse.success("Đã gán lại người duyệt", viewService.chainOf(kpiId, me.getId())));
    }
}
