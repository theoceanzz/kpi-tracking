package com.kpitracking.enums;

/** Cách xử lý MỘT đợt chưa hoàn thành khi khoá kỳ (Phương án 2). */
public enum PeriodLockAction {
    /** Chuyển sang kỳ khác: nguyên đợt nếu chưa KPI nào được đánh giá, ngược lại tách đợt. */
    TRANSFER,
    /** Chốt tại hiện trạng: KPI dở → CLOSED_BY_LOCK, không tính điểm. */
    CLOSE,
    /** Huỷ — chỉ khi đợt chưa bắt đầu (không KPI hoặc chỉ KPI nháp). */
    CANCEL
}
