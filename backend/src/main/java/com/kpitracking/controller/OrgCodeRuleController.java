package com.kpitracking.controller;

import com.kpitracking.dto.request.organization.OrgCodeRuleRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.organization.CodePreviewResponse;
import com.kpitracking.dto.response.organization.OrgCodeRuleResponse;
import com.kpitracking.enums.CodeType;
import com.kpitracking.service.OrgCodeRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Quy tắc sinh mã của tổ chức.
 *
 * Quyền ĐỌC nới rộng hơn quyền SỬA: các form tạo Mục tiêu / KR / hạng mục BSC phải biết mã
 * đang được sinh tự động hay không để khoá ô nhập, nên người chỉ có quyền quản lý OKR/BSC
 * cũng đọc được. Quyền SỬA vẫn là COMPANY:UPDATE như mọi thiết lập cấp tổ chức khác.
 */
@RestController
@RequestMapping("/api/v1/organizations/{orgId}/code-rules")
@RequiredArgsConstructor
public class OrgCodeRuleController {

    private final OrgCodeRuleService orgCodeRuleService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('COMPANY:VIEW', 'ORG:VIEW', 'OKR:VIEW', 'OKR:MANAGE', 'BSC:VIEW', 'BSC:MANAGE')")
    public ResponseEntity<ApiResponse<List<OrgCodeRuleResponse>>> getRules(@PathVariable UUID orgId) {
        return ResponseEntity.ok(ApiResponse.success(orgCodeRuleService.getRules(orgId)));
    }

    /** Xem trước mã kế tiếp cho một mẫu — dùng khi người dùng đang gõ mẫu mà chưa lưu. */
    @GetMapping("/preview")
    @PreAuthorize("hasAnyAuthority('COMPANY:VIEW', 'ORG:VIEW', 'OKR:VIEW', 'OKR:MANAGE', 'BSC:VIEW', 'BSC:MANAGE')")
    public ResponseEntity<ApiResponse<CodePreviewResponse>> preview(
            @PathVariable UUID orgId,
            @RequestParam CodeType type,
            @RequestParam(required = false) String pattern) {
        return ResponseEntity.ok(ApiResponse.success(orgCodeRuleService.preview(orgId, type, pattern)));
    }

    @PutMapping
    @PreAuthorize("hasAuthority('COMPANY:UPDATE')")
    public ResponseEntity<ApiResponse<List<OrgCodeRuleResponse>>> updateRules(
            @PathVariable UUID orgId,
            @Valid @RequestBody List<OrgCodeRuleRequest> requests) {
        return ResponseEntity.ok(ApiResponse.success(orgCodeRuleService.updateRules(orgId, requests)));
    }
}
