package com.kpitracking.enums;

public enum ApprovalStepStatus {
    /** Chưa tới lượt: bước dưới chưa duyệt xong. */
    WAITING,
    /** Đang chờ người giữ bước thao tác. */
    PENDING,
    APPROVED_FORWARDED,
    APPROVED_FINAL,
    REJECTED,
    /** Cấp dưới có quyền duyệt cuối đã chốt — bước này không còn việc. */
    SKIPPED_DELEGATED,
    /** Đơn vị chưa có trưởng (hoặc trưởng không có quyền duyệt) — ghi nhận lúc lập chuỗi. */
    SKIPPED_NO_HEAD,
    /** Mọi người giữ bước bị vô hiệu hoá khi đang chờ ⇒ tự chuyển lên cấp trên. */
    SKIPPED_INACTIVE,
    /** Flow dừng giữa chừng (huỷ / khoá kỳ). */
    CANCELLED;

    public boolean isSkipped() {
        return this == SKIPPED_DELEGATED || this == SKIPPED_NO_HEAD || this == SKIPPED_INACTIVE;
    }
}
