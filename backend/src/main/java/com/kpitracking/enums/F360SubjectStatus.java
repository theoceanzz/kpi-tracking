package com.kpitracking.enums;

/** Trạng thái của một người được đánh giá trong chiến dịch 360. */
public enum F360SubjectStatus {
    NOMINATING,
    NOMINATION_SUBMITTED,
    APPROVED,
    COLLECTING,
    /** Đã đóng và đủ phiếu cho ít nhất một nhóm ngoài tự đánh giá. */
    COMPLETED,
    /** Đã đóng nhưng thiếu phiếu — báo cáo vẫn có, gắn cờ. */
    INSUFFICIENT
}
