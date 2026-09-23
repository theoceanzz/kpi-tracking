package com.kpitracking.enums;

/** Hành động trên đánh giá kỳ của một đơn vị (dùng cho lịch sử/timeline). */
public enum CycleUnitEvalAction {
    /** Chốt dữ liệu kỳ: đóng đầu vào, chụp điểm nền, bước sang hiệu chỉnh. */
    CALIBRATE,
    /** Khoá kết quả (chốt đánh giá phòng ban). */
    FINALIZE,
    /** Mở khoá: FINALIZED → CALIBRATING, hoặc CALIBRATING → DRAFT. */
    REOPEN
}
