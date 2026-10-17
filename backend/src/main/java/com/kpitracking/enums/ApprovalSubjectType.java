package com.kpitracking.enums;

/**
 * Đối tượng đi qua chuỗi duyệt: chỉ tiêu KPI (tạo mới / thay thế), yêu cầu điều chỉnh, bài nộp kết
 * quả, đánh giá đợt của quản lý, chốt kỳ của một đơn vị, thẻ điểm BSC, chốt kết quả thẻ điểm đơn vị,
 * đề xuất khen thưởng, đổi quà nội bộ, đơn từ.
 */
public enum ApprovalSubjectType {
    CRITERIA,
    ADJUSTMENT,
    SUBMISSION,
    EVALUATION,
    CYCLE_FINALIZE,
    BSC_SCORECARD,
    BSC_RESULT,
    REWARD_GRANT,
    GIFT_REDEMPTION,
    /** Đơn từ (nghỉ phép, thanh toán…): quy trình nằm trên chính đơn, không ở danh sách quy trình duyệt. */
    FORM_REQUEST
}
