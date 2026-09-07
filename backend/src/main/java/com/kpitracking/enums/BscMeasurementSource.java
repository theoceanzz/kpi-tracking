package com.kpitracking.enums;

/**
 * Kết quả thực đạt của một dòng chỉ tiêu BSC đơn vị lấy từ đâu.
 *
 * <p>{@link #ROLLUP} — cộng từ KPI cá nhân đang gắn vào dòng này (mặc định).
 * <p>{@link #MANUAL} — người phụ trách tự nhập; dùng cho chỉ tiêu không phân rã hết xuống cá nhân
 * (VD doanh thu toàn phòng lấy từ báo cáo tài chính).
 * <p>{@link #DATASOURCE} — lấy từ bảng dữ liệu đã kết nối. Đã dành sẵn chỗ, chưa nối trong bước này.
 */
public enum BscMeasurementSource {
    ROLLUP,
    MANUAL,
    DATASOURCE
}
