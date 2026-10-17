package com.kpitracking.controller.approvalprocess;

import com.kpitracking.dto.request.approvalprocess.ApprovalProcessIdsRequest;
import com.kpitracking.dto.request.approvalprocess.ApprovalProcessRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.approvalprocess.ApprovalProcessCatalogResponse;
import com.kpitracking.dto.response.approvalprocess.ApprovalProcessResponse;
import com.kpitracking.dto.response.approvalprocess.ProcessValidationResponse;
import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.service.approvalprocess.ApprovalProcessService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Quy trình duyệt của tổ chức. Đọc: người cấu hình luồng hoặc quản trị công ty (giống mục
 * "Luồng KPI"); ghi: chỉ {@code WORKFLOW:MANAGE}. Tổ chức suy từ người đăng nhập.
 */
@RestController
@RequestMapping("/api/v1/approval-processes")
@RequiredArgsConstructor
@Tag(name = "Approval processes", description = "Quy trình duyệt: sơ đồ điều kiện + bước duyệt cho từng đối tượng")
public class ApprovalProcessController {

    private static final String READ = "hasAnyAuthority('WORKFLOW:MANAGE','COMPANY:UPDATE')";
    private static final String WRITE = "hasAuthority('WORKFLOW:MANAGE')";

    private final ApprovalProcessService service;

    @GetMapping
    @PreAuthorize(READ)
    @Operation(summary = "Danh sách quy trình duyệt")
    public ResponseEntity<ApiResponse<PageResponse<ApprovalProcessResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) ApprovalObjectType objectType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(service.list(keyword, objectType, page, size)));
    }

    @GetMapping("/catalog")
    @PreAuthorize(READ)
    @Operation(summary = "Đối tượng, trường điều kiện và loại người duyệt dùng trên màn sửa quy trình")
    public ResponseEntity<ApiResponse<ApprovalProcessCatalogResponse>> catalog() {
        return ResponseEntity.ok(ApiResponse.success(service.catalog()));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<ApprovalProcessResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(service.get(id)));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ApprovalProcessResponse>> create(@Valid @RequestBody ApprovalProcessRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ApprovalProcessResponse>> update(@PathVariable UUID id,
                                                                       @Valid @RequestBody ApprovalProcessRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, request)));
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize(WRITE)
    @Operation(summary = "Bật / tắt áp dụng quy trình")
    public ResponseEntity<ApiResponse<ApprovalProcessResponse>> setActive(@PathVariable UUID id,
                                                                          @RequestBody Map<String, Boolean> body) {
        return ResponseEntity.ok(ApiResponse.success(service.setActive(id, Boolean.TRUE.equals(body.get("active")))));
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Integer>> delete(@Valid @RequestBody ApprovalProcessIdsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.delete(request.getIds())));
    }

    /** Kiểm sơ đồ mà không lưu. */
    @PostMapping("/validate")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<ProcessValidationResponse>> validate(@RequestBody ApprovalProcessRequest request) {
        return ResponseEntity.ok(ApiResponse.success(service.validate(request)));
    }
}
