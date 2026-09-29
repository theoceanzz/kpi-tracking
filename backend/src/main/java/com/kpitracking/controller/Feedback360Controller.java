package com.kpitracking.controller;

import com.kpitracking.dto.request.feedback360.F360AnswersRequest;
import com.kpitracking.dto.request.feedback360.F360ReasonRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.feedback360.*;
import com.kpitracking.service.feedback360.F360ReportService;
import com.kpitracking.service.feedback360.F360ResponseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Đánh giá 360 phía người dùng: người chấm điền phiếu, người được đánh giá xem báo cáo.
 *
 * Chấm phiếu không cần quyền riêng — ai là người chấm của phiếu thì chấm được, kiểm ở service.
 * Xem báo cáo đi qua {@code F360AccessPolicy}: báo cáo của chính mình chỉ xem được khi đã công bố,
 * kể cả khi người xem có quyền quản lý.
 */
@RestController
@RequestMapping("/api/v1/feedback360")
@RequiredArgsConstructor
@Tag(name = "Feedback 360", description = "Phiếu đánh giá 360 và báo cáo")
public class Feedback360Controller {

    private final F360ResponseService responseService;
    private final F360ReportService reportService;
    private final com.kpitracking.service.feedback360.F360NominationService nominationService;

    @GetMapping("/me/nominations")
    @Operation(summary = "Danh sách người chấm ĐỀ XUẤT của tôi (chỉ khi chiến dịch đang đề cử)")
    public ResponseEntity<ApiResponse<List<F360NominationResponse>>> myNominations() {
        return ResponseEntity.ok(ApiResponse.success(nominationService.myNominations()));
    }

    @PutMapping("/me/nominations/{subjectId}")
    @Operation(summary = "Đề cử người chấm cho chính mình", description = "Danh sách gửi lên thay thế các đề cử trước.")
    public ResponseEntity<ApiResponse<F360NominationResponse>> nominate(
            @PathVariable UUID subjectId, @RequestBody com.kpitracking.dto.request.feedback360.F360NominateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã gửi đề cử",
                nominationService.nominate(subjectId, request.getRaterIds())));
    }

    @GetMapping("/approvals")
    @Operation(summary = "Hàng chờ duyệt đề cử của tôi")
    public ResponseEntity<ApiResponse<List<F360NominationResponse>>> approvals() {
        return ResponseEntity.ok(ApiResponse.success(nominationService.pendingApprovals()));
    }

    @PutMapping("/approvals/{subjectId}")
    @Operation(summary = "Chỉnh và duyệt danh sách người chấm", description = "Không áp cho chính mình.")
    public ResponseEntity<ApiResponse<F360NominationResponse>> approve(
            @PathVariable UUID subjectId, @RequestBody com.kpitracking.dto.request.feedback360.F360ApprovalRequest request) {
        return ResponseEntity.ok(ApiResponse.success(Boolean.TRUE.equals(request.getApprove()) ? "Đã duyệt" : "Đã lưu",
                nominationService.approve(subjectId, request)));
    }

    @GetMapping("/me/tasks")
    @Operation(summary = "Hộp \"Cần đánh giá\" của tôi")
    public ResponseEntity<ApiResponse<List<F360TaskResponse>>> myTasks() {
        return ResponseEntity.ok(ApiResponse.success(responseService.myTasks()));
    }

    @GetMapping("/me/reports")
    @PreAuthorize("hasAuthority('FEEDBACK360:VIEW_MY')")
    @Operation(summary = "Báo cáo 360 đã công bố của tôi")
    public ResponseEntity<ApiResponse<List<F360MyReportResponse>>> myReports() {
        return ResponseEntity.ok(ApiResponse.success(reportService.myReports()));
    }

    @GetMapping("/assignments/{assignmentId}")
    @Operation(summary = "Mở phiếu đánh giá")
    public ResponseEntity<ApiResponse<F360FormResponse>> getForm(@PathVariable UUID assignmentId) {
        return ResponseEntity.ok(ApiResponse.success(responseService.getForm(assignmentId)));
    }

    @PutMapping("/assignments/{assignmentId}/draft")
    @Operation(summary = "Lưu nháp (chỉ gửi những câu vừa sửa)")
    public ResponseEntity<ApiResponse<F360FormResponse>> saveDraft(
            @PathVariable UUID assignmentId, @Valid @RequestBody F360AnswersRequest request) {
        return ResponseEntity.ok(ApiResponse.success(responseService.saveDraft(assignmentId, request)));
    }

    @PostMapping("/assignments/{assignmentId}/submit")
    @Operation(summary = "Nộp phiếu (sau khi nộp không sửa được)")
    public ResponseEntity<ApiResponse<F360FormResponse>> submit(
            @PathVariable UUID assignmentId, @Valid @RequestBody F360AnswersRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã nộp phiếu đánh giá", responseService.submit(assignmentId, request)));
    }

    @PostMapping("/assignments/{assignmentId}/decline")
    @Operation(summary = "Từ chối chấm phiếu này")
    public ResponseEntity<ApiResponse<Void>> decline(
            @PathVariable UUID assignmentId, @Valid @RequestBody F360ReasonRequest request) {
        responseService.decline(assignmentId, request.getReason());
        return ResponseEntity.ok(ApiResponse.success("Đã từ chối phiếu"));
    }

    @GetMapping("/subjects/{subjectId}/report")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:VIEW_MY', 'FEEDBACK360:VIEW', 'FEEDBACK360:MANAGE')")
    @Operation(summary = "Báo cáo 360 của một người")
    public ResponseEntity<ApiResponse<F360ReportResponse>> report(@PathVariable UUID subjectId) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getReport(subjectId)));
    }

    @PostMapping("/answers/{answerId}/hide")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Ẩn nhận xét vi phạm", description = "Không áp cho báo cáo của chính người bấm.")
    public ResponseEntity<ApiResponse<Void>> hideAnswer(
            @PathVariable UUID answerId, @Valid @RequestBody F360ReasonRequest request) {
        reportService.hideAnswer(answerId, request.getReason());
        return ResponseEntity.ok(ApiResponse.success("Đã ẩn nhận xét"));
    }
}
