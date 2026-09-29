package com.kpitracking.enums;

public enum ApprovalStepKind {
    /** Trưởng một đơn vị trên đường từ đơn vị của KPI lên gốc. */
    UNIT_HEAD,
    /** Chuỗi không còn ai phía trên người tạo ⇒ admin tổ chức duyệt thay (quyết định C3). */
    ADMIN_FALLBACK
}
