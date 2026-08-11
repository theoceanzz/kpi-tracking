package com.kpitracking.controller;

import com.kpitracking.dto.request.admin.UpdateOrgAiBudgetRequest;
import com.kpitracking.dto.request.admin.UpdateOrgFeaturesRequest;
import com.kpitracking.dto.request.admin.UpdateOrgStatusRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.admin.OrgAiUsageResponse;
import com.kpitracking.dto.response.admin.OrganizationAdminResponse;
import com.kpitracking.dto.response.admin.PlatformAdminStatsResponse;
import com.kpitracking.service.PlatformAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Platform Admin", description = "Platform-level administration endpoints")
public class PlatformAdminController {

    private final PlatformAdminService platformAdminService;

    @GetMapping("/stats")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "Get platform-wide statistics")
    public ResponseEntity<ApiResponse<PlatformAdminStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(platformAdminService.getStats()));
    }

    @GetMapping("/organizations")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "List all organizations")
    public ResponseEntity<ApiResponse<PageResponse<OrganizationAdminResponse>>> getOrganizations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(platformAdminService.getOrganizations(page, size)));
    }

    @PatchMapping("/organizations/{orgId}/features")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "Toggle feature flags for an organization")
    public ResponseEntity<ApiResponse<OrganizationAdminResponse>> updateFeatures(
            @PathVariable UUID orgId,
            @RequestBody UpdateOrgFeaturesRequest request) {
        return ResponseEntity.ok(ApiResponse.success(platformAdminService.updateFeatures(orgId, request)));
    }

    @PatchMapping("/organizations/{orgId}/status")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "Update organization status (approve / suspend / archive)")
    public ResponseEntity<ApiResponse<OrganizationAdminResponse>> updateStatus(
            @PathVariable UUID orgId,
            @Valid @RequestBody UpdateOrgStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(platformAdminService.updateStatus(orgId, request)));
    }

    @PatchMapping("/organizations/{orgId}/ai-budget")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "Đặt ngân sách token AI/tháng cho một công ty")
    public ResponseEntity<ApiResponse<OrganizationAdminResponse>> updateAiBudget(
            @PathVariable UUID orgId,
            @Valid @RequestBody UpdateOrgAiBudgetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật ngân sách token",
                platformAdminService.updateAiBudget(orgId, request.getAiMonthlyTokenLimit())));
    }

    @GetMapping("/ai-usage")
    @PreAuthorize("@permissionChecker.isPlatformAdmin(authentication.name)")
    @Operation(summary = "Tiêu thụ token AI theo từng công ty trong một tháng")
    public ResponseEntity<ApiResponse<List<OrgAiUsageResponse>>> getAiUsage(
            @RequestParam(required = false) String month) {
        // month dạng YYYY-MM; bỏ trống thì lấy tháng hiện tại
        LocalDate period = (month == null || month.isBlank())
                ? LocalDate.now().withDayOfMonth(1)
                : LocalDate.parse(month + "-01");
        return ResponseEntity.ok(ApiResponse.success(platformAdminService.getAiUsageByOrganization(period)));
    }
}
