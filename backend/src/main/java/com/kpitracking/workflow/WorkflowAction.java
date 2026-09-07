package com.kpitracking.workflow;

/**
 * Các HÀNH ĐỘNG chuyển trạng thái trong luồng KPI.
 *
 * <p>Mỗi hành động thuộc về đúng một {@link WorkflowStage}. Khi bước đó bị tổ chức tắt, mọi hành
 * động của nó biến mất khỏi {@code WorkflowDefinition} — gọi tới sẽ bị
 * {@code StageEnabledGuard} chặn thay vì âm thầm chạy.
 */
public enum WorkflowAction {

    SUBMIT_CRITERIA(WorkflowStage.CRITERIA_APPROVAL),
    APPROVE_CRITERIA(WorkflowStage.CRITERIA_APPROVAL),
    REJECT_CRITERIA(WorkflowStage.CRITERIA_APPROVAL),
    REVERT_CRITERIA_APPROVAL(WorkflowStage.CRITERIA_APPROVAL),

    REQUEST_ADJUSTMENT(WorkflowStage.CRITERIA_ADJUSTMENT),
    APPROVE_ADJUSTMENT(WorkflowStage.CRITERIA_ADJUSTMENT),
    REJECT_ADJUSTMENT(WorkflowStage.CRITERIA_ADJUSTMENT),

    CREATE_SUBMISSION(WorkflowStage.SUBMISSION),
    UPDATE_SUBMISSION(WorkflowStage.SUBMISSION),

    APPROVE_SUBMISSION(WorkflowStage.SUBMISSION_REVIEW),
    REJECT_SUBMISSION(WorkflowStage.SUBMISSION_REVIEW),

    CREATE_SELF_EVALUATION(WorkflowStage.SELF_EVALUATION),
    CREATE_EVALUATION(WorkflowStage.MANAGER_EVALUATION),

    FINALIZE_CYCLE(WorkflowStage.CYCLE_EVALUATION),
    REOPEN_CYCLE(WorkflowStage.CYCLE_EVALUATION);

    private final WorkflowStage stage;

    WorkflowAction(WorkflowStage stage) {
        this.stage = stage;
    }

    public WorkflowStage getStage() {
        return stage;
    }
}
