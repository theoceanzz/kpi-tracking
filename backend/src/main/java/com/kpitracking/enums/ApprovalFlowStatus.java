package com.kpitracking.enums;

public enum ApprovalFlowStatus {
    IN_PROGRESS,
    APPROVED,
    REJECTED,
    /** Đối tượng bị xoá / bị thay / bị hoàn duyệt — flow dừng mà không có quyết định. */
    CANCELLED,
    /** KPI bị chốt CLOSED_BY_LOCK khi khoá kỳ. */
    CLOSED_BY_LOCK;

    public boolean isTerminal() {
        return this != IN_PROGRESS;
    }
}
