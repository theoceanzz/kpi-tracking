package com.kpitracking.enums;

/**
 * Phạm vi của một tài liệu — quyết định AI VÀ màn danh sách cho ai đọc (docs/DOCUMENTS_DESIGN.md §3).
 * Tên enum được ghi nguyên vào metadata {@code scope} của vector; đổi tên là vector cũ không ai đọc được nữa.
 */
public enum DocumentScope {
    /** Chỉ chính chủ. */
    PERSONAL,
    /** Thành viên đơn vị và các đơn vị con; người quản lý ở đơn vị cha. */
    UNIT,
    /** Mọi thành viên của tổ chức. */
    COMPANY
}
