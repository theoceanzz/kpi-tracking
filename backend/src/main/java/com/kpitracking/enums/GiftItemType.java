package com.kpitracking.enums;

/** Loại quà trong danh mục. */
public enum GiftItemType {
    /** Quà nội bộ, tổ chức tự trao tay. */
    INTERNAL,
    /**
     * Voucher lấy từ nhà cung cấp ngoài. Giá trị đã khai sẵn để sau này bật lên
     * không phải sửa ràng buộc CHECK của cơ sở dữ liệu — v1 giao diện chưa cho tạo loại này.
     */
    EXTERNAL_VOUCHER
}
