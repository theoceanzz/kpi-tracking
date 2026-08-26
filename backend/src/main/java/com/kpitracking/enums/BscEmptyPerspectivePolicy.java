package com.kpitracking.enums;

/**
 * Chính sách xử lý lĩnh vực rỗng (nhân viên không có KPI nào trong lĩnh vực) khi tính điểm BSC.
 * RENORMALIZE - loại lĩnh vực rỗng khỏi cả tử và mẫu số rồi chuẩn hóa lại (không trừ oan).
 * ZERO_FILL   - tính lĩnh vực rỗng bằng 0 điểm (khắt khe hơn).
 */
public enum BscEmptyPerspectivePolicy {
    RENORMALIZE,
    ZERO_FILL
}
