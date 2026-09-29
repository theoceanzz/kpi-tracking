package com.kpitracking.enums;

/** Tiến độ của một đợt, tính từ trạng thái các KPI trong đợt (không lưu DB). */
public enum PeriodProgress {
    /** Mọi KPI đã ở trạng thái cuối, hoặc đợt không có KPI và đã quá hạn, hoặc đợt đã đóng. */
    COMPLETED,
    /** Có ít nhất một KPI chưa ở trạng thái cuối. */
    IN_PROGRESS,
    /** Chưa có KPI nào, hoặc chỉ có KPI nháp. */
    NOT_STARTED
}
