package com.kpitracking.enums;

/** Hành động ghi vào lịch sử kỳ ({@code kpi_cycle_events}). */
public enum KpiCycleEventAction {
    LOCK,
    EXTEND,
    REOPEN,
    /** Chuyển nguyên đợt sang kỳ khác. */
    PERIOD_TRANSFER,
    /** Tách đợt: KPI dở sang đợt mới ở kỳ khác, phần đã xong đóng lại ở kỳ cũ. */
    PERIOD_SPLIT,
    /** Chốt đợt tại hiện trạng. */
    PERIOD_CLOSE,
    /** Huỷ đợt chưa bắt đầu. */
    PERIOD_CANCEL
}
