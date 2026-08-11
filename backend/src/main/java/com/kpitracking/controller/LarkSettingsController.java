package com.kpitracking.controller;

import com.kpitracking.dto.request.auth.LarkCallbackRequest;
import com.kpitracking.dto.request.organization.UpdateLarkSettingsRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.auth.LarkAuthorizeUrlResponse;
import com.kpitracking.dto.response.organization.LarkConnectResultResponse;
import com.kpitracking.dto.response.organization.LarkSettingsResponse;
import com.kpitracking.service.LarkOAuthClient;
import com.kpitracking.service.LarkSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{orgId}/lark-settings")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('COMPANY:UPDATE')")
@Tag(name = "Lark Settings", description = "Kết nối tổ chức với Lark")
public class LarkSettingsController {

    private final LarkSettingsService larkSettingsService;

    @GetMapping
    @Operation(summary = "Trạng thái kết nối Lark của tổ chức")
    public ResponseEntity<ApiResponse<LarkSettingsResponse>> getSettings(@PathVariable UUID orgId) {
        return ResponseEntity.ok(ApiResponse.success(larkSettingsService.getSettings(orgId)));
    }

    @PutMapping
    @Operation(summary = "Cập nhật cấu hình Lark")
    public ResponseEntity<ApiResponse<LarkSettingsResponse>> updateSettings(
            @PathVariable UUID orgId,
            @Valid @RequestBody UpdateLarkSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã lưu cấu hình Lark", larkSettingsService.updateSettings(orgId, request)));
    }

    @PostMapping("/test")
    @Operation(summary = "Kiểm tra App ID / App Secret có hợp lệ không")
    public ResponseEntity<ApiResponse<LarkOAuthClient.TestResult>> testConnection(@PathVariable UUID orgId) {
        return ResponseEntity.ok(ApiResponse.success(larkSettingsService.testConnection(orgId)));
    }

    @GetMapping("/connect-url")
    @Operation(summary = "URL để quản trị viên đăng nhập Lark và liên kết tổ chức")
    public ResponseEntity<ApiResponse<LarkAuthorizeUrlResponse>> getConnectUrl(@PathVariable UUID orgId) {
        return ResponseEntity.ok(ApiResponse.success(larkSettingsService.getConnectUrl(orgId)));
    }

    @PostMapping("/connect")
    @Operation(summary = "Đọc tổ chức Lark vừa đăng nhập, chờ xác nhận")
    public ResponseEntity<ApiResponse<LarkConnectResultResponse>> connect(
            @PathVariable UUID orgId,
            @Valid @RequestBody LarkCallbackRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                larkSettingsService.connect(request.getCode(), request.getState())));
    }

    @PostMapping("/connect/confirm")
    @Operation(summary = "Xác nhận liên kết tổ chức với Lark")
    public ResponseEntity<ApiResponse<LarkSettingsResponse>> confirmConnection(
            @PathVariable UUID orgId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success("Đã liên kết với Lark",
                larkSettingsService.confirmConnection(body.get("pendingToken"))));
    }

    @DeleteMapping("/connection")
    @Operation(summary = "Huỷ liên kết Lark")
    public ResponseEntity<ApiResponse<LarkSettingsResponse>> disconnect(@PathVariable UUID orgId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Đã huỷ liên kết Lark", larkSettingsService.disconnect(orgId)));
    }
}
