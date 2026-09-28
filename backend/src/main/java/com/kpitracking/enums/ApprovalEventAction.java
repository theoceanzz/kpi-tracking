package com.kpitracking.enums;

public enum ApprovalEventAction {
    SUBMITTED,
    APPROVED_FORWARD,
    APPROVED_FINAL,
    REJECTED,
    SKIPPED_DELEGATED,
    SKIPPED_NO_HEAD,
    SKIPPED_INACTIVE,
    /** Người tạo là cấp duyệt cao nhất và có KPI:APPROVE_OWN ⇒ duyệt ngay (quyết định C3). */
    SELF_APPROVED_TOP,
    REASSIGNED,
    AUTO_ESCALATED,
    REMINDED,
    CANCELLED,
    CLOSED_BY_LOCK,
    /** Flow được lập cho KPI đang chờ theo luồng cũ khi triển khai chuỗi duyệt. */
    MIGRATED
}
