package com.kpitracking.controller;

import com.kpitracking.dto.request.ai.AiCriteriaItemsRequest;
import com.kpitracking.dto.request.ai.AiCriteriaSetMetaRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.ai.AiCriteriaChangeRequestResponse;
import com.kpitracking.dto.response.ai.AiCriteriaSetResponse;
import com.kpitracking.service.ai.review.AiCriteriaAuthority;
import com.kpitracking.service.ai.review.AiCriteriaChangeRequestService;
import com.kpitracking.service.ai.review.AiCriteriaSetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * Bộ tiêu chí chấm của AI đánh giá bài nộp (GĐ2): máy bóc từ tài liệu, người đối chiếu và áp cho đơn vị.
 * Mỗi đơn vị một tài liệu đang áp ({@code CONFIRMED}); quản lý áp trong phạm vi của mình, tài liệu của cấp trên
 * thì gửi đề nghị. Quyền theo đơn vị kiểm ở service ({@code AiCriteriaAuthority}).
 */
@RestController
@RequestMapping("/api/v1/ai/criteria-sets")
@Tag(name = "AI Criteria Sets", description = "Bộ tiêu chí chấm do AI bóc, người xác nhận")
@PreAuthorize("hasAnyAuthority('AI_REVIEW:CONFIG', 'AI_CRITERIA:MANAGE')")
@RequiredArgsConstructor
public class AiCriteriaSetController {

    private final AiCriteriaSetService criteriaSetService;
    private final AiCriteriaChangeRequestService requestService;

    @GetMapping("/manageable-units")
    @Operation(summary = "Đơn vị người dùng áp được quy chế (orgWide = được áp cho cả tổ chức)")
    public ResponseEntity<ApiResponse<AiCriteriaAuthority.Scope>> manageableUnits() {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.manageableUnits()));
    }

    @PostMapping("/{id}/stop")
    @Operation(summary = "Ngừng áp dụng (đơn vị quay về tài liệu cấp trên / thang chung)")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> stop(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.stop(id)));
    }

    @PostMapping("/{id}/apply")
    @Operation(summary = "Áp lại tài liệu đã ngừng cho một đơn vị chưa có tài liệu đang áp")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> reapply(@PathVariable UUID id,
                                                                     @Valid @RequestBody AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.reapply(id, request.getOrgUnitId())));
    }

    @PostMapping("/{id}/requests")
    @Operation(summary = "Gửi đề nghị áp tài liệu này cho đơn vị đang áp tài liệu của cấp trên")
    public ResponseEntity<ApiResponse<AiCriteriaChangeRequestResponse>> requestChange(@PathVariable UUID id,
                                                                                     @Valid @RequestBody AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(requestService.create(id, request)));
    }

    @PostMapping("/{id}/clone-request")
    @Operation(summary = "Nhân bản thành bản nháp cho đơn vị bị khoá rồi gửi đề nghị")
    public ResponseEntity<ApiResponse<AiCriteriaChangeRequestResponse>> cloneAndRequest(@PathVariable UUID id,
                                                                                       @Valid @RequestBody AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(requestService.cloneAndRequest(id, request)));
    }

    @GetMapping("/requests/pending")
    @Operation(summary = "Đề nghị đổi quy chế người dùng quyết được")
    public ResponseEntity<ApiResponse<List<AiCriteriaChangeRequestResponse>>> pendingRequests() {
        return ResponseEntity.ok(ApiResponse.success(requestService.pendingForMe()));
    }

    @PostMapping("/requests/{requestId}/approve")
    @Operation(summary = "Đồng ý đề nghị: đơn vị chuyển sang tài liệu được đề nghị")
    public ResponseEntity<ApiResponse<AiCriteriaChangeRequestResponse>> approve(@PathVariable UUID requestId,
                                                                               @Valid @RequestBody(required = false) AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(requestService.approve(requestId, request == null ? null : request.getNote())));
    }

    @PostMapping("/requests/{requestId}/reject")
    @Operation(summary = "Từ chối đề nghị (kèm lý do)")
    public ResponseEntity<ApiResponse<AiCriteriaChangeRequestResponse>> reject(@PathVariable UUID requestId,
                                                                              @Valid @RequestBody(required = false) AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(requestService.reject(requestId, request == null ? null : request.getNote())));
    }

    @DeleteMapping("/requests/{requestId}")
    @Operation(summary = "Rút đề nghị (người gửi)")
    public ResponseEntity<ApiResponse<Void>> cancelRequest(@PathVariable UUID requestId) {
        requestService.cancel(requestId);
        return ResponseEntity.ok(ApiResponse.success("Đã rút đề nghị"));
    }

    @GetMapping
    @Operation(summary = "Các bộ tiêu chí của tổ chức (mọi phiên bản)")
    public ResponseEntity<ApiResponse<List<AiCriteriaSetResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.list()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Chi tiết một bộ tiêu chí")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.get(id)));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Tải tài liệu lên để AI bóc thành bản nháp bộ tiêu chí")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> upload(@RequestPart("file") MultipartFile file,
                                                                    @RequestParam(required = false) UUID orgUnitId,
                                                                    @RequestParam(required = false) String title) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.upload(file, orgUnitId, title)));
    }

    @PutMapping("/{id}/items")
    @Operation(summary = "Sửa các dòng của bản nháp sau khi đối chiếu")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> updateItems(@PathVariable UUID id,
                                                                         @Valid @RequestBody AiCriteriaItemsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.updateItems(id, request)));
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Xác nhận bản nháp thành phiên bản dùng để chấm")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> confirm(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.confirm(id)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Sửa tên / đơn vị áp dụng (bộ đang dùng chỉ sang đơn vị chưa có bộ đang dùng)")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> updateInfo(@PathVariable UUID id,
                                                                        @Valid @RequestBody AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.updateInfo(id, request)));
    }

    @PostMapping("/{id}/clone")
    @Operation(summary = "Nhân bản sang đơn vị chưa có bộ đang dùng (tên trống thì tự đặt)")
    public ResponseEntity<ApiResponse<AiCriteriaSetResponse>> cloneTo(@PathVariable UUID id,
                                                                     @Valid @RequestBody AiCriteriaSetMetaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(criteriaSetService.cloneTo(id, request)));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Xoá một bộ tiêu chí (mọi trạng thái)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        criteriaSetService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Đã xoá bộ tiêu chí"));
    }
}
