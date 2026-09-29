package com.kpitracking.enums;

/**
 * Nhóm tiến độ của MỘT KPI khi xét khoá kỳ. Thứ tự khai báo là thứ tự vòng đời.
 */
public enum KpiProgressBucket {
    /** Nháp. */
    DRAFT,
    /** Chờ duyệt chỉ tiêu (gồm cả đang chờ duyệt điều chỉnh). */
    PENDING_APPROVAL,
    /** Chỉ tiêu bị trả về. */
    REJECTED,
    /** Đã duyệt nhưng còn người được giao chưa nộp đủ kết quả (lần nộp mới nhất bị từ chối cũng tính là chưa nộp). */
    NOT_SUBMITTED,
    /** Đã nộp đủ, còn bài nộp chờ quản lý duyệt. */
    SUBMISSION_PENDING,
    /** Kết quả đã duyệt đủ, còn người được giao chưa được quản lý đánh giá đợt. */
    AWAITING_EVALUATION,
    /** Đã duyệt + đã nộp + đã đánh giá. */
    COMPLETED,
    /** Kết thúc không qua đánh giá: dừng (INACTIVE), bị thay thế (REPLACED), chốt do khoá kỳ. */
    CLOSED;

    /** KPI đã ở trạng thái cuối — không cần xử lý gì khi khoá kỳ. */
    public boolean isFinal() {
        return this == COMPLETED || this == CLOSED;
    }
}
