package com.kpitracking.controller.approvalform;

import com.kpitracking.dto.approvalform.ApprovalFormDtos.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.document.ShareTargetResponse;
import com.kpitracking.dto.response.document.ShareUnitResponse;
import com.kpitracking.service.approvalform.ApprovalFormService;
import com.kpitracking.service.approvalform.ApprovalRequestService;
import com.kpitracking.service.document.DocumentShareService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Quản trị đơn từ: nhóm đơn và đơn. Nhóm, tạo đơn, sắp xếp: {@code APPROVAL_FORM:MANAGE}. Sửa / tắt / xoá một đơn:
 * thêm người quản lý đơn theo quyền gán trên đơn đó — kiểm trong service nên các đường đó chỉ cần đăng nhập.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Approval forms", description = "Đơn từ: nhóm đơn, form, quy trình duyệt của đơn")
public class ApprovalFormController {

    private static final String MANAGE = "hasAuthority('APPROVAL_FORM:MANAGE')";

    private final ApprovalFormService service;
    private final ApprovalRequestService requestService;
    private final DocumentShareService shareService;

    @GetMapping("/approval-forms/catalog")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Nhóm và đơn người gọi được nộp")
    public ResponseEntity<ApiResponse<Catalog>> catalog() {
        return ResponseEntity.ok(ApiResponse.success(requestService.catalog()));
    }

    @GetMapping("/approval-forms/admin")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Nhóm + đơn người gọi quản lý được (dựng sẵn nhóm / đơn mẫu lần đầu)")
    public ResponseEntity<ApiResponse<AdminView>> admin() {
        return ResponseEntity.ok(ApiResponse.success(service.adminView()));
    }

    @GetMapping("/approval-forms/library")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thư viện mẫu đơn, chữ theo ngôn ngữ của request")
    public ResponseEntity<ApiResponse<Library>> library() {
        return ResponseEntity.ok(ApiResponse.success(service.library()));
    }

    @GetMapping("/approval-forms/process-options")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Danh mục điều kiện + chức vụ / cấp / đơn vị cho bước Quy trình duyệt của đơn")
    public ResponseEntity<ApiResponse<ProcessOptions>> processOptions() {
        return ResponseEntity.ok(ApiResponse.success(service.processOptions()));
    }

    @GetMapping("/approval-forms/directory/targets")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Tìm người / đơn vị trong tổ chức (widget Liên hệ, Phòng ban, người được nộp)")
    public ResponseEntity<ApiResponse<List<ShareTargetResponse>>> targets(@RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(shareService.targets(q)));
    }

    @GetMapping("/approval-forms/directory/units")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Cây đơn vị của tổ chức (trừ đơn vị gốc)")
    public ResponseEntity<ApiResponse<List<ShareUnitResponse>>> units() {
        return ResponseEntity.ok(ApiResponse.success(shareService.unitTree()));
    }

    @GetMapping("/approval-forms/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FormDetail>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.get(id)));
    }

    @PostMapping("/approval-forms")
    @PreAuthorize(MANAGE)
    @Operation(summary = "Phát hành đơn mới")
    public ResponseEntity<ApiResponse<FormDetail>> create(@Valid @RequestBody FormRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.create(request)));
    }

    @PutMapping("/approval-forms/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Phát hành lại đơn (version lệch ⇒ 409)")
    public ResponseEntity<ApiResponse<FormDetail>> update(@PathVariable UUID id, @Valid @RequestBody FormRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, request)));
    }

    @PatchMapping("/approval-forms/{id}/active")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> setActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        service.setActive(id, Boolean.TRUE.equals(body.get("active")));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/approval-forms/{id}/names")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Đổi tên / mô tả song ngữ")
    public ResponseEntity<ApiResponse<Void>> rename(@PathVariable UUID id, @Valid @RequestBody NamesRequest request) {
        service.rename(id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/approval-forms/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Nhóm ────────────────────────────────────────────────────────────────

    @PostMapping("/approval-form-groups")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Group>> createGroup(@Valid @RequestBody GroupRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.createGroup(request)));
    }

    @PutMapping("/approval-form-groups/{id}")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Group>> updateGroup(@PathVariable UUID id, @Valid @RequestBody GroupRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.updateGroup(id, request)));
    }

    @PatchMapping("/approval-form-groups/{id}/active")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Void>> setGroupActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        service.setGroupActive(id, Boolean.TRUE.equals(body.get("active")));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/approval-form-groups/{id}")
    @PreAuthorize(MANAGE)
    @Operation(summary = "Xoá nhóm rỗng")
    public ResponseEntity<ApiResponse<Void>> deleteGroup(@PathVariable UUID id) {
        service.deleteGroup(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/approval-form-groups/order")
    @PreAuthorize(MANAGE)
    @Operation(summary = "Sắp thứ tự nhóm")
    public ResponseEntity<ApiResponse<Void>> reorderGroups(@Valid @RequestBody OrderRequest request) {
        service.reorderGroups(request.ids());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/approval-form-groups/{id}/forms/order")
    @PreAuthorize(MANAGE)
    @Operation(summary = "Sắp thứ tự đơn trong nhóm")
    public ResponseEntity<ApiResponse<Void>> reorderForms(@PathVariable UUID id, @Valid @RequestBody OrderRequest request) {
        service.reorderForms(id, request.ids());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
