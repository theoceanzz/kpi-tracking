package com.kpitracking.enums.approvalform;

/** Quyền của một người quản lý đơn (Process administrator) trên đúng đơn đó. */
public enum FormAdminPermission {
    /** Sửa thông tin + form, bật/tắt, xoá đơn. */
    EDIT_FORM,
    /** Thêm / bớt người quản lý đơn. */
    MANAGE_ADMINS,
    /** Sửa quy trình duyệt của đơn. */
    MANAGE_PROCESS
}
