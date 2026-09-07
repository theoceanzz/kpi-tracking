package com.kpitracking.controller;

import com.kpitracking.dto.request.dashboard.SaveDashboardLayoutRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.dashboard.DashboardLayoutResponse;
import com.kpitracking.enums.DashboardScope;
import com.kpitracking.service.DashboardLayoutService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Bố cục trang chủ tuỳ chỉnh. Chỉ cần đăng nhập — đây là preference của chính người dùng,
 * không gắn với quyền xem dữ liệu nào (nhân viên cấp thấp không có DASHBOARD:VIEW vẫn phải dùng được).
 */
@RestController
@RequestMapping("/api/v1/dashboard/layout")
@RequiredArgsConstructor
@Tag(name = "Dashboard Layout", description = "Bố cục trang chủ tuỳ chỉnh theo từng người dùng")
public class DashboardLayoutController {

    private final DashboardLayoutService dashboardLayoutService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lấy bố cục trang chủ của tôi theo vai trò")
    public ResponseEntity<ApiResponse<DashboardLayoutResponse>> get(@RequestParam DashboardScope scope) {
        return ResponseEntity.ok(ApiResponse.success(dashboardLayoutService.get(scope)));
    }

    @PutMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lưu bố cục trang chủ của tôi")
    public ResponseEntity<ApiResponse<DashboardLayoutResponse>> save(
            @Valid @RequestBody SaveDashboardLayoutRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Đã lưu bố cục", dashboardLayoutService.save(request)));
    }

    @DeleteMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Đặt lại bố cục về mặc định")
    public ResponseEntity<Void> reset(@RequestParam DashboardScope scope) {
        dashboardLayoutService.reset(scope);
        return ResponseEntity.noContent().build();
    }
}
