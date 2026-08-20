package com.kpitracking.enums;

/**
 * Vai trò quyết định danh mục widget của trang chủ. Mỗi scope có một bố cục lưu riêng
 * vì widget của giám đốc, trưởng đơn vị và nhân viên gần như không giao nhau.
 */
public enum DashboardScope {
    DIRECTOR,
    HEAD,
    /**
     * Phó đơn vị: phạm vi hẹp hơn trưởng đơn vị (chỉ mảng mình phụ trách) và phần lớn
     * widget là theo dõi thay vì hành động, nên bố cục lưu tách khỏi {@link #HEAD}.
     */
    DEPUTY,
    STAFF
}
