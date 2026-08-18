package com.kpitracking.enums;

/**
 * Nghiệp vụ nào sinh ra giao dịch điểm. Dùng để tách báo cáo
 * ("thưởng thủ công" so với "thưởng theo xếp hạng") mà không phải suy từ ghi chú.
 */
public enum RewardSourceType {
    /** Sếp tự chọn người để thưởng. */
    MANUAL_GRANT,
    /** Chương trình thưởng tự động theo bảng xếp hạng đợt/kỳ. */
    AUTO_RANKING,
    /** Đổi quà: trừ điểm khi đặt, hoàn điểm khi từ chối/huỷ. */
    REDEMPTION,
    /** Điểm danh hàng ngày: nhân viên tự bấm nhận điểm, gồm cả thưởng chuỗi. */
    CHECKIN,
    /** Điều chỉnh do quản trị viên thực hiện tay. */
    SYSTEM,
    /** Nạp/trừ từ hệ thống ngoài (HRM, ví điện tử...). Chừa sẵn, chưa dùng ở v1. */
    EXTERNAL
}
