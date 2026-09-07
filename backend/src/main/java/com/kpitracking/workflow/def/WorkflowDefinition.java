package com.kpitracking.workflow.def;

import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.workflow.WorkflowAction;
import com.kpitracking.workflow.WorkflowStage;

/**
 * DẠNG CHẠY của luồng: ý muốn của tổ chức ({@link WorkflowConfig}) đã được nở ra thành các bảng
 * chuyển trạng thái có kiểu.
 *
 * <p>Ba máy trạng thái vì hệ thống có ba họ thực thể mang trạng thái riêng. Một hành động có thể
 * chạm hai máy cùng lúc — duyệt yêu cầu điều chỉnh vừa đẩy {@code AdjustmentStatus}
 * {@code PENDING → APPROVED} vừa đẩy {@code KpiStatus} {@code EDIT → EDITED}.
 */
public record WorkflowDefinition(
        WorkflowConfig config,
        StateMachine<KpiStatus> criteria,
        StateMachine<SubmissionStatus> submission,
        StateMachine<AdjustmentStatus> adjustment
) {
    public boolean isStageEnabled(WorkflowStage stage) {
        return config.isEnabled(stage);
    }

    public boolean isActionAvailable(WorkflowAction action) {
        return isStageEnabled(action.getStage());
    }

    public StageConfig stageConfig(WorkflowStage stage) {
        return config.stage(stage).orElseGet(() -> StageConfig.builder().code(stage).enabled(true).build());
    }
}
