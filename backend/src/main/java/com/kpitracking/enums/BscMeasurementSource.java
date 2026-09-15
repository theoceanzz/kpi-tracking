package com.kpitracking.enums;

/**
 * Kết quả thực đạt của một dòng chỉ tiêu BSC đơn vị lấy từ đâu.
 *
 * <p>{@link #ROLLUP} — cộng từ KPI cá nhân đang gắn vào dòng này (mặc định).
 * <p>{@link #MANUAL} — người phụ trách tự nhập; dùng cho chỉ tiêu không phân rã hết xuống cá nhân
 * (VD doanh thu toàn phòng lấy từ báo cáo tài chính).
 * <p>{@link #DATASOURCE} — lấy từ bảng dữ liệu đã kết nối. Đã dành sẵn chỗ, chưa nối trong bước này.
 * <p>{@link #CHILD_ROLLUP} — cộng từ kết quả của các ĐƠN VỊ CON đã nhận phân rã chỉ tiêu này.
 * Giá trị này KHÔNG chọn được lúc cấu hình: nó chỉ xuất hiện trên dòng KẾT QUẢ, khi hệ thống thấy
 * chỉ tiêu đã được giao xuống cấp dưới và lấy số từ đó thay vì cộng KPI cá nhân.
 */
public enum BscMeasurementSource {
    ROLLUP,
    MANUAL,
    DATASOURCE,
    CHILD_ROLLUP
}
