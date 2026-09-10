package com.kpitracking.controller;

import com.kpitracking.dto.request.delegation.DelegationRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.delegation.DelegationResponse;
import com.kpitracking.service.OrgUnitDelegationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Uỷ quyền quản lý chéo đơn vị. Dùng chung quyền {@code ROLE:ASSIGN} với việc gán vai trò:
 * đây là cùng một loại quyết định nhân sự, tách ra một mã quyền riêng chỉ khiến tổ chức
 * phải cấu hình thêm mà không đổi ai được làm.
 */
@RestController
@RequestMapping("/api/v1/delegations")
@RequiredArgsConstructor
@Tag(name = "Org Unit Delegations", description = "Uỷ quyền quản lý chéo đơn vị")
public class OrgUnitDelegationController {

    private final OrgUnitDelegationService delegationService;

    @GetMapping("/{organizationId}")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Danh sách uỷ quyền của tổ chức")
    public ResponseEntity<ApiResponse<List<DelegationResponse>>> list(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(ApiResponse.success(delegationService.list(organizationId)));
    }

    @PostMapping("/{organizationId}")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Uỷ quyền cho một người quản lý thêm một hoặc nhiều đơn vị khác cây")
    public ResponseEntity<ApiResponse<List<DelegationResponse>>> create(
            @PathVariable UUID organizationId, @Valid @RequestBody DelegationRequest request) {
        List<DelegationResponse> response = delegationService.create(organizationId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Đã uỷ quyền quản lý " + response.size() + " đơn vị", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE:ASSIGN')")
    @Operation(summary = "Thu hồi uỷ quyền")
    public ResponseEntity<ApiResponse<Void>> revoke(@PathVariable UUID id) {
        delegationService.revoke(id);
        return ResponseEntity.ok(ApiResponse.success("Đã thu hồi uỷ quyền", null));
    }
}
