package com.kpitracking.controller;

import com.kpitracking.dto.request.feedback360.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.feedback360.*;
import com.kpitracking.service.feedback360.F360CampaignService;
import com.kpitracking.service.feedback360.F360TemplateService;
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
 * Quản trị đánh giá 360: bộ câu hỏi và chiến dịch.
 *
 * {@code @PreAuthorize} chỉ là cửa ngoài; phạm vi tổ chức, luật "không thao tác trên chính mình"
 * và trạng thái chiến dịch được kiểm ở service ({@code F360AccessPolicy}).
 */
@RestController
@RequestMapping("/api/v1/feedback360")
@RequiredArgsConstructor
@Tag(name = "Feedback 360 — quản trị", description = "Bộ câu hỏi và chiến dịch đánh giá 360 độ")
public class Feedback360AdminController {

    private final F360TemplateService templateService;
    private final F360CampaignService campaignService;
    private final com.kpitracking.service.feedback360.F360AnalyticsService analyticsService;

    // ───────────────────────── Bộ câu hỏi ─────────────────────────

    @GetMapping("/templates")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Danh sách bộ câu hỏi 360 của tổ chức")
    public ResponseEntity<ApiResponse<List<F360TemplateResponse>>> listTemplates(@RequestParam UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(templateService.list(organizationId)));
    }

    @GetMapping("/templates/{templateId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Chi tiết một bộ câu hỏi")
    public ResponseEntity<ApiResponse<F360TemplateResponse>> getTemplate(
            @RequestParam UUID organizationId, @PathVariable UUID templateId) {
        return ResponseEntity.ok(ApiResponse.success(templateService.get(organizationId, templateId)));
    }

    @PostMapping("/templates")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Tạo bộ câu hỏi", description = "Không gửi nội dung thì chép từ copyFromId (mặc định: bộ mặc định).")
    public ResponseEntity<ApiResponse<F360TemplateResponse>> createTemplate(
            @RequestParam UUID organizationId, @Valid @RequestBody F360TemplateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo bộ câu hỏi", templateService.create(organizationId, request)));
    }

    @PutMapping("/templates/{templateId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Lưu bộ câu hỏi", description = "Năng lực và câu hỏi gửi lên thay thế toàn bộ; tổng trọng số phải bằng 100%.")
    public ResponseEntity<ApiResponse<F360TemplateResponse>> updateTemplate(
            @RequestParam UUID organizationId, @PathVariable UUID templateId,
            @Valid @RequestBody F360TemplateRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu bộ câu hỏi",
                templateService.update(organizationId, templateId, request)));
    }

    @DeleteMapping("/templates/{templateId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Xoá bộ câu hỏi (không ảnh hưởng chiến dịch đã khởi động)")
    public ResponseEntity<ApiResponse<Void>> deleteTemplate(
            @RequestParam UUID organizationId, @PathVariable UUID templateId) {
        templateService.delete(organizationId, templateId);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá bộ câu hỏi"));
    }

    @PostMapping("/templates/{templateId}/default")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Đặt làm bộ mặc định")
    public ResponseEntity<ApiResponse<F360TemplateResponse>> markDefault(
            @RequestParam UUID organizationId, @PathVariable UUID templateId) {
        return ResponseEntity.ok(ApiResponse.success("Đã đặt bộ mặc định",
                templateService.markDefault(organizationId, templateId)));
    }

    // ───────────────────────── Chiến dịch ─────────────────────────

    @GetMapping("/campaigns")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW')")
    @Operation(summary = "Danh sách chiến dịch 360", description = "Quản lý đơn vị không thấy bản nháp.")
    public ResponseEntity<ApiResponse<List<F360CampaignResponse>>> listCampaigns(@RequestParam UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.list(organizationId)));
    }

    @GetMapping("/campaigns/{campaignId}")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW')")
    @Operation(summary = "Chi tiết chiến dịch")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> getCampaign(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.get(campaignId)));
    }

    @PostMapping("/campaigns")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Tạo chiến dịch (bản nháp)")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> createCampaign(
            @RequestParam UUID organizationId, @Valid @RequestBody F360CampaignRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã tạo chiến dịch", campaignService.create(organizationId, request)));
    }

    @PutMapping("/campaigns/{campaignId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Sửa chiến dịch", description = "Đang mở chỉ sửa được tên, mô tả và hạn.")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> updateCampaign(
            @PathVariable UUID campaignId, @Valid @RequestBody F360CampaignRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu chiến dịch", campaignService.update(campaignId, request)));
    }

    @DeleteMapping("/campaigns/{campaignId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Xoá chiến dịch (chỉ bản nháp)")
    public ResponseEntity<ApiResponse<Void>> deleteCampaign(@PathVariable UUID campaignId) {
        campaignService.delete(campaignId);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá chiến dịch"));
    }

    @GetMapping("/campaigns/{campaignId}/questions")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW')")
    @Operation(summary = "Câu hỏi của chiến dịch (nháp: bộ đang soạn; đã khởi động: bản chụp)")
    public ResponseEntity<ApiResponse<F360TemplateResponse>> getCampaignQuestions(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.questions(campaignId)));
    }

    @GetMapping("/campaigns/{campaignId}/subjects")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW')")
    @Operation(summary = "Người được đánh giá kèm tiến độ dạng số đếm",
            description = "Quản lý chỉ thấy người trong phạm vi; dòng của chính người xem luôn bị lọc.")
    public ResponseEntity<ApiResponse<List<F360SubjectRowResponse>>> listSubjects(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.listSubjects(campaignId)));
    }

    @PostMapping("/campaigns/{campaignId}/subjects")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Thêm người được đánh giá (theo người hoặc theo đơn vị)")
    public ResponseEntity<ApiResponse<List<F360SubjectRowResponse>>> addSubjects(
            @PathVariable UUID campaignId, @RequestBody F360AddSubjectsRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã thêm người được đánh giá",
                campaignService.addSubjects(campaignId, request)));
    }

    @DeleteMapping("/campaigns/{campaignId}/subjects/{subjectId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Gỡ người được đánh giá")
    public ResponseEntity<ApiResponse<Void>> removeSubject(@PathVariable UUID campaignId, @PathVariable UUID subjectId) {
        campaignService.removeSubject(campaignId, subjectId);
        return ResponseEntity.ok(ApiResponse.success("Đã gỡ người được đánh giá"));
    }

    @PostMapping("/campaigns/{campaignId}/generate-raters")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Sinh người chấm tự động từ cây tổ chức",
            description = "reset=true xoá phiếu tự sinh rồi sinh lại cho mọi người.")
    public ResponseEntity<ApiResponse<F360GenerateResultResponse>> generateRaters(
            @PathVariable UUID campaignId, @RequestParam(defaultValue = "false") boolean reset) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.generateRaters(campaignId, reset)));
    }

    @GetMapping("/campaigns/{campaignId}/subjects/{subjectId}/assignments")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Người chấm của một người và trạng thái từng phiếu (chỉ HR)")
    public ResponseEntity<ApiResponse<List<F360AssignmentRowResponse>>> listAssignments(
            @PathVariable UUID campaignId, @PathVariable UUID subjectId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.listAssignments(campaignId, subjectId)));
    }

    @PostMapping("/campaigns/{campaignId}/assignments")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Thêm người chấm")
    public ResponseEntity<ApiResponse<F360AssignmentRowResponse>> addAssignment(
            @PathVariable UUID campaignId, @Valid @RequestBody F360AddAssignmentRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã thêm người chấm", campaignService.addAssignment(campaignId, request)));
    }

    @DeleteMapping("/campaigns/{campaignId}/assignments/{assignmentId}")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Gỡ người chấm (chỉ phiếu chưa nộp)")
    public ResponseEntity<ApiResponse<Void>> removeAssignment(
            @PathVariable UUID campaignId, @PathVariable UUID assignmentId) {
        campaignService.removeAssignment(campaignId, assignmentId);
        return ResponseEntity.ok(ApiResponse.success("Đã gỡ người chấm"));
    }

    @PostMapping("/campaigns/{campaignId}/assignments/{assignmentId}/reopen")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Mở lại phiếu đã nộp để chính người chấm sửa", description = "Bắt buộc lý do; người chấm được báo.")
    public ResponseEntity<ApiResponse<Void>> reopenAssignment(
            @PathVariable UUID campaignId, @PathVariable UUID assignmentId,
            @Valid @RequestBody F360ReasonRequest request) {
        campaignService.reopenAssignment(campaignId, assignmentId, request.getReason());
        return ResponseEntity.ok(ApiResponse.success("Đã mở lại phiếu"));
    }

    @PostMapping("/campaigns/{campaignId}/launch")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Khởi động chiến dịch: chụp câu hỏi, mời người chấm")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> launch(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("Đã khởi động chiến dịch", campaignService.launch(campaignId)));
    }

    @PostMapping("/campaigns/{campaignId}/start")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Kết thúc đề cử và bắt đầu chấm", description = "Ai chưa được duyệt đề cử thì tự duyệt.")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> start(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("Đã bắt đầu giai đoạn chấm", campaignService.start(campaignId)));
    }

    @GetMapping("/campaigns/{campaignId}/analytics")
    @PreAuthorize("hasAnyAuthority('FEEDBACK360:MANAGE', 'FEEDBACK360:VIEW')")
    @Operation(summary = "Heatmap năng lực × đơn vị", description = "Đơn vị dưới ngưỡng ẩn danh được gộp lên đơn vị cha.")
    public ResponseEntity<ApiResponse<F360HeatmapResponse>> analytics(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success(analyticsService.heatmap(campaignId)));
    }

    @GetMapping("/campaigns/{campaignId}/export")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Xuất Excel kết quả (không có danh tính người chấm)")
    public ResponseEntity<byte[]> export(@PathVariable UUID campaignId) {
        byte[] body = analyticsService.exportExcel(campaignId);
        String name = java.net.URLEncoder.encode(analyticsService.exportFileName(campaignId),
                java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + name)
                .contentType(org.springframework.http.MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    @PostMapping("/campaigns/{campaignId}/subjects/{subjectId}/ai-summary")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Tạo lại tóm tắt AI cho một người (chạy nền)")
    public ResponseEntity<ApiResponse<Void>> regenerateSummary(@PathVariable UUID campaignId, @PathVariable UUID subjectId) {
        campaignService.regenerateSummary(campaignId, subjectId);
        return ResponseEntity.ok(ApiResponse.success("Đang tạo lại tóm tắt, tải lại báo cáo sau ít phút"));
    }

    @PostMapping("/campaigns/{campaignId}/extend")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Gia hạn")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> extend(
            @PathVariable UUID campaignId, @Valid @RequestBody F360DueRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã gia hạn", campaignService.extend(campaignId, request.getDueAt())));
    }

    @PostMapping("/campaigns/{campaignId}/close")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Đóng chiến dịch, tính và chụp kết quả")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> close(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("Đã đóng chiến dịch", campaignService.close(campaignId)));
    }

    @PostMapping("/campaigns/{campaignId}/reopen")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Mở lại chiến dịch đã đóng", description = "Bắt buộc lý do và hạn mới.")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> reopen(
            @PathVariable UUID campaignId, @Valid @RequestBody F360ReasonRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã mở lại chiến dịch",
                campaignService.reopen(campaignId, request.getReason(), request.getDueAt())));
    }

    @PostMapping("/campaigns/{campaignId}/release")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Công bố báo cáo cho người được đánh giá")
    public ResponseEntity<ApiResponse<F360CampaignResponse>> release(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success("Đã công bố báo cáo", campaignService.release(campaignId)));
    }

    @PostMapping("/campaigns/{campaignId}/remind")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Nhắc những phiếu chưa nộp")
    public ResponseEntity<ApiResponse<Integer>> remind(@PathVariable UUID campaignId) {
        int n = campaignService.remind(campaignId);
        return ResponseEntity.ok(ApiResponse.success(n == 0 ? "Không có phiếu nào cần nhắc lúc này"
                : "Đã nhắc " + n + " phiếu", n));
    }

    @GetMapping("/campaigns/{campaignId}/events")
    @PreAuthorize("hasAuthority('FEEDBACK360:MANAGE')")
    @Operation(summary = "Nhật ký chiến dịch")
    public ResponseEntity<ApiResponse<List<F360EventResponse>>> events(@PathVariable UUID campaignId) {
        return ResponseEntity.ok(ApiResponse.success(campaignService.events(campaignId)));
    }
}
