package com.kpitracking.controller;

import com.kpitracking.dto.approvalform.ApprovalFormDtos.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.service.approvalform.ApprovalRequestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Nộp và theo dõi đơn từ. Ai được nộp đơn nào, ai xem được đơn nào: kiểm trong service theo đơn. Duyệt / từ chối
 * dùng {@code /api/v1/approvals/flows/{flowId}/approve|reject} chung.
 */
@RestController
@RequestMapping("/api/v1/approval-requests")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Approval requests", description = "Đơn từ đã nộp: nộp, trạng thái, rút đơn")
public class ApprovalRequestController {

    private final ApprovalRequestService service;

    @GetMapping("/forms/{formId}")
    @Operation(summary = "Form để nộp, kèm đơn vị của người nộp")
    public ResponseEntity<ApiResponse<SubmitView>> form(@PathVariable UUID formId) {
        return ResponseEntity.ok(ApiResponse.success(service.submitView(formId)));
    }

    @PostMapping(value = "/uploads", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải tệp cho widget Ảnh / Tệp đính kèm trước khi nộp")
    public ResponseEntity<ApiResponse<List<UploadedFile>>> upload(@RequestParam("files") MultipartFile[] files)
            throws IOException {
        return ResponseEntity.ok(ApiResponse.success(service.upload(files)));
    }

    @PostMapping("/preview-flow")
    @Operation(summary = "Các bước duyệt đơn sẽ đi với giá trị đang điền")
    public ResponseEntity<ApiResponse<FlowPreview>> previewFlow(@Valid @RequestBody SubmitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.previewFlow(request)));
    }

    @PostMapping
    @Operation(summary = "Nộp đơn")
    public ResponseEntity<ApiResponse<RequestDetail>> submit(@Valid @RequestBody SubmitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.submit(request)));
    }

    @GetMapping
    @Operation(summary = "Đơn theo mục: TODO (cần duyệt), DONE (đã xử lý), SUBMITTED (đã nộp), IN_REVIEW (đang xem xét)")
    public ResponseEntity<ApiResponse<PageResponse<RequestItem>>> list(
            @RequestParam ApprovalRequestService.Box box,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(service.list(box, q, page, size)));
    }

    @GetMapping("/counts")
    public ResponseEntity<ApiResponse<Counts>> counts() {
        return ResponseEntity.ok(ApiResponse.success(service.counts()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RequestDetail>> detail(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.detail(id)));
    }

    @PostMapping("/{id}/withdraw")
    @Operation(summary = "Rút đơn còn chờ duyệt")
    public ResponseEntity<ApiResponse<RequestDetail>> withdraw(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.withdraw(id)));
    }
}
