package com.kpitracking.dto.response.workflow;

import com.kpitracking.workflow.def.WorkflowUiConfig;
import lombok.*;

import java.util.List;

/** Toàn bộ luồng KPI đang hiệu lực của tổ chức người gọi. */
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WorkflowConfigResponse {

    private int schemaVersion;

    /** Đã sắp theo thứ tự hiển thị của tổ chức. */
    private List<WorkflowStageResponse> stages;

    private WorkflowUiConfig ui;

    /** Cảnh báo không chặn lưu — hiện tại chỉ dùng cho đường kiểm thử cấu hình. */
    private List<String> warnings;

    /** Người gọi có quyền sửa cấu hình này không (tránh frontend phải tự đoán). */
    private boolean canManage;
}
