package com.kpitracking.enums;

/**
 * Mức áp dụng ràng buộc "KPI cá nhân phải có tối thiểu N% trọng số liên kết BSC" (QĐ-8).
 *
 * <p>{@link #WARN} — MẶC ĐỊNH: cảnh báo lúc trình duyệt, người duyệt tự quyết. Bật BLOCK ngay
 * kỳ đầu sẽ làm kẹt hàng loạt nhân viên chưa kịp gắn KPI vào BSC, và người duyệt mất luôn quyền
 * linh hoạt với trường hợp chính đáng (nhân sự mới, người kiêm nhiệm dự án).
 * <p>{@link #BLOCK} — chặn hẳn, không cho trình. Bật khi tổ chức đã chạy trôi ít nhất một kỳ.
 */
public enum BscLinkedWeightEnforce {
    WARN,
    BLOCK
}
