package com.kpitracking.enums;

/**
 * Trạng thái LƯU của đợt. Các trạng thái tiến độ (Hoàn thành / Đang dở / Chưa bắt đầu) không
 * lưu mà tính ra từ KPI mỗi lần cần — xem {@link PeriodProgress}.
 */
public enum KpiPeriodStatus {
    /** Đợt bình thường. */
    ACTIVE,
    /** Chốt tại hiện trạng khi khoá kỳ: KPI dở đã chuyển CLOSED_BY_LOCK. */
    CLOSED_BY_LOCK,
    /** Đợt bị tách khi khoá kỳ: KPI dở đã sang đợt mới ở kỳ khác, phần còn lại đóng ở đây. */
    TRANSFERRED,
    /** Đợt chưa bắt đầu bị huỷ khi khoá kỳ (KPI nháp đã xoá mềm). */
    CANCELLED;

    /** Đợt đã kết thúc vòng đời — không còn gì để xử lý khi khoá. */
    public boolean isTerminal() {
        return this != ACTIVE;
    }
}
