package com.kpitracking.enums;

/** Trạng thái một phiếu (người chấm × người được đánh giá). */
public enum F360AssignmentStatus {
    PENDING,
    IN_PROGRESS,
    /** Đã nộp: không sửa, không gỡ. Chỉ HR mở lại được, có lý do và log. */
    SUBMITTED,
    DECLINED,
    /** HR/quản lý gỡ khỏi danh sách — chỉ áp cho phiếu chưa nộp. */
    REMOVED,
    /** Đóng chiến dịch mà chưa nộp, hoặc người chấm đã nghỉ việc. */
    EXPIRED;

    /** Phiếu còn đang chờ người chấm làm. */
    public boolean open() {
        return this == PENDING || this == IN_PROGRESS;
    }
}
