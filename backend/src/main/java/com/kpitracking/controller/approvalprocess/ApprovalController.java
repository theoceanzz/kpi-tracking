package com.kpitracking.controller.approvalprocess;

import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.kpi.approval.ApprovalInboxItemResponse;
import com.kpitracking.enums.kpi.ApprovalOutcome;
import com.kpitracking.service.kpi.approval.ApprovalActionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Getter;
import lombok.Setter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Hộp "Chờ tôi duyệt" chung cho mọi đối tượng đi theo quy trình duyệt, và duyệt / từ chối các đề
 * xuất chưa có màn riêng (đánh giá đợt, chốt kỳ…). Quyền thao tác là "đang giữ bước hiện tại", do
 * chuỗi duyệt kiểm — nên endpoint chỉ đòi đăng nhập.
 */
@RestController
@RequestMapping("/api/v1/approvals")
@RequiredArgsConstructor
@Tag(name = "Approvals", description = "Hộp chờ duyệt chung và duyệt đề xuất theo quy trình")
public class ApprovalController {

    private final ApprovalActionService actionService;

    @Getter @Setter
    public static class DecisionRequest {
        private UUID expectedStepId;
        /** Nhận xét khi duyệt; lý do (bắt buộc) khi từ chối. */
        private String comment;
    }

    @GetMapping("/inbox")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mọi việc đang chờ người gọi duyệt ở bước hiện tại")
    public ResponseEntity<ApiResponse<List<ApprovalInboxItemResponse>>> inbox() {
        return ResponseEntity.ok(ApiResponse.success(actionService.inbox()));
    }

    @GetMapping("/flows/{flowId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Một đề xuất kèm chuỗi duyệt")
    public ResponseEntity<ApiResponse<ApprovalActionService.Detail>> detail(@PathVariable UUID flowId) {
        return ResponseEntity.ok(ApiResponse.success(actionService.detail(flowId)));
    }

    @PostMapping("/flows/{flowId}/approve")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Duyệt bước hiện tại; bước cuối thì áp đề xuất")
    public ResponseEntity<ApiResponse<ApprovalOutcome>> approve(@PathVariable UUID flowId,
                                                               @RequestBody(required = false) DecisionRequest request) {
        DecisionRequest r = request == null ? new DecisionRequest() : request;
        return ResponseEntity.ok(ApiResponse.success(actionService.approve(flowId, r.getExpectedStepId(), r.getComment())));
    }

    @PostMapping("/flows/{flowId}/reject")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Từ chối đề xuất (cần lý do)")
    public ResponseEntity<ApiResponse<Void>> reject(@PathVariable UUID flowId, @RequestBody DecisionRequest request) {
        actionService.reject(flowId, request.getExpectedStepId(), request.getComment());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
