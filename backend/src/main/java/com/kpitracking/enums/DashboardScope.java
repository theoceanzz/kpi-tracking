package com.kpitracking.enums;

/**
 * Khu vực lưới sở hữu một bố cục widget. Mỗi khu vực có bố cục lưu riêng.
 *
 * <p>Bốn giá trị đầu là vai trò ở TRANG CHỦ: widget của giám đốc, trưởng đơn vị và nhân viên gần
 * như không giao nhau nên không thể dùng chung một bố cục. Các giá trị {@code ANALYTICS_*} là các
 * tab Thống kê — chúng cũng dùng đúng lưới kéo thả đó, nên dùng luôn cơ chế lưu này thay vì cách
 * cũ (giấu bố cục trong một "report" đặt tên đặc biệt).
 *
 * <p>Enum này là nơi DUY NHẤT quyết định giá trị hợp lệ: cơ sở dữ liệu chỉ kiểm dạng chữ, còn
 * request mang giá trị lạ bị chặn ngay ở bước deserialize.
 */
public enum DashboardScope {
    DIRECTOR,
    HEAD,
    /**
     * Phó đơn vị: phạm vi hẹp hơn trưởng đơn vị (chỉ mảng mình phụ trách) và phần lớn
     * widget là theo dõi thay vì hành động, nên bố cục lưu tách khỏi {@link #HEAD}.
     */
    DEPUTY,
    STAFF,

    /** Tab Thống kê › Tổng quan. */
    ANALYTICS_SUMMARY,
    /** Tab Thống kê › KPI của tôi. */
    ANALYTICS_MY_KPI,
    /** Tab Thống kê › Mục tiêu của tôi (tổ chức bật OKR). */
    ANALYTICS_MY_OBJECTIVES,
    /** Tab Thống kê › Quản lý cấp dưới (tổ chức bật OKR). */
    ANALYTICS_SUBORDINATE,
    /** Tab Thống kê › So sánh các đơn vị (phân cấp theo cây đơn vị). */
    ANALYTICS_DRILLDOWN,
    /** Tab Thống kê › Hạng mục BSC (tổ chức bật BSC). */
    ANALYTICS_BSC
}
