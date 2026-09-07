package com.kpitracking.enums;

/**
 * Loại quan hệ giữa một chỉ tiêu con và chỉ tiêu cha (BRD FR-016).
 *
 * <p>Không được dùng MỘT công thức roll-up cho mọi quan hệ — đó là lý do enum này tồn tại.
 *
 * <p>{@link #SUM} — cộng dồn vào chỉ tiêu cha; tham gia phép tính độ phủ.
 * <p>{@link #SHARED} — nhiều đơn vị cùng chịu trách nhiệm MỘT chỉ tiêu (không cộng dồn, nếu
 * cộng sẽ đếm nhiều lần cùng một kết quả).
 * <p>{@link #SUPPORT} — vai trò hỗ trợ, không đóng góp con số vào chỉ tiêu cha.
 * <p>{@link #CUSTOM} — công thức riêng; hệ thống không tự suy diễn, người cấu hình tự chịu trách nhiệm.
 */
public enum BscLinkType {
    SUM,
    SHARED,
    SUPPORT,
    CUSTOM
}
