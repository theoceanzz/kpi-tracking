package com.kpitracking.enums;

/**
 * Đề nghị thưởng này được duyệt kiểu gì.
 *
 * <p>Tách riêng khỏi {@link RewardGrantStatus} thay vì thêm một trạng thái
 * AUTO_APPROVED, để câu hỏi "bao nhiêu lần thưởng đi tắt không qua duyệt" trả lời
 * được bằng một câu query mà không phải phân biệt trạng thái.
 */
public enum RewardApprovalMode {
    /** Nằm trong hạn mức ⇒ hệ thống tự duyệt ngay khi tạo. */
    AUTO,
    /** Phải qua người có REWARD:APPROVE. */
    MANUAL
}
