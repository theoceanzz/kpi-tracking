package com.kpitracking.enums;

/**
 * Chính sách xử lý viễn cảnh rỗng (nhân viên không có KPI nào trong viễn cảnh) khi tính điểm BSC.
 * RENORMALIZE - loại viễn cảnh rỗng khỏi cả tử và mẫu số rồi chuẩn hóa lại (không trừ oan).
 * ZERO_FILL   - tính viễn cảnh rỗng bằng 0 điểm (khắt khe hơn).
 */
public enum BscEmptyPerspectivePolicy {
    RENORMALIZE,
    ZERO_FILL
}
