package com.kpitracking.controller;

import com.kpitracking.dto.request.workflow.UpdateWorkflowConfigRequest;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.workflow.WorkflowConfigResponse;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.WorkflowResponseAssembler;
import com.kpitracking.workflow.def.WorkflowConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Cấu hình luồng KPI của tổ chức.
 *
 * <p>Không endpoint nào nhận {@code organizationId} từ client — tổ chức suy từ chính người đang
 * đăng nhập. {@code SidebarSettingController} làm ngược lại (nhận id trên đường dẫn, không có
 * {@code @PreAuthorize} nào) nên bất kỳ ai đăng nhập cũng đọc/ghi được cấu hình của tổ chức khác;
 * đây là chỗ không lặp lại lỗi đó.
 */
@RestController
@RequestMapping("/api/v1/kpi-workflow")
@RequiredArgsConstructor
public class KpiWorkflowController {

    private final KpiWorkflowConfigService configService;
    private final WorkflowResponseAssembler assembler;
    private final PermissionChecker permissionChecker;

    /** Luồng đang hiệu lực. Ai đăng nhập cũng đọc được vì menu và thanh tiến trình cần tới. */
    @GetMapping("/config")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<WorkflowConfigResponse>> getConfig() {
        WorkflowConfig config = configService.currentConfig();
        return ResponseEntity.ok(ApiResponse.success(assembler.toResponse(config, canManage(), List.of())));
    }

    @PutMapping("/config")
    @PreAuthorize("hasAuthority('WORKFLOW:MANAGE')")
    public ResponseEntity<ApiResponse<WorkflowConfigResponse>> updateConfig(
            @RequestBody UpdateWorkflowConfigRequest request) {
        WorkflowConfig saved = configService.save(request.toConfig());
        return ResponseEntity.ok(ApiResponse.success("Đã cập nhật luồng KPI",
                assembler.toResponse(saved, true, List.of())));
    }

    /** Kiểm một cấu hình mà KHÔNG lưu, để giao diện cảnh báo ngay trong lúc người dùng chỉnh. */
    @PostMapping("/config/validate")
    @PreAuthorize("hasAuthority('WORKFLOW:MANAGE')")
    public ResponseEntity<ApiResponse<List<String>>> validateConfig(
            @RequestBody UpdateWorkflowConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.success(configService.dryRun(request.toConfig())));
    }

    @PostMapping("/config/reset")
    @PreAuthorize("hasAuthority('WORKFLOW:MANAGE')")
    public ResponseEntity<ApiResponse<WorkflowConfigResponse>> resetConfig() {
        WorkflowConfig defaults = configService.reset();
        return ResponseEntity.ok(ApiResponse.success("Đã khôi phục luồng KPI mặc định",
                assembler.toResponse(defaults, true, List.of())));
    }

    private boolean canManage() {
        return permissionChecker.hasPermission(configService.currentUser().getId(), "WORKFLOW:MANAGE");
    }
}
