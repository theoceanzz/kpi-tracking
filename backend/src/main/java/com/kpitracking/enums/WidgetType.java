package com.kpitracking.enums;

import java.util.Set;

/** Loại widget của form đơn từ (bước "Thiết kế form"), theo bộ widget của Lark Approval. */
public enum WidgetType {
    TEXT, TEXTAREA, DESCRIPTION,
    NUMBER, AMOUNT, FORMULA,
    RADIO, CHECKBOX,
    DATE, DATE_RANGE,
    TABLE, IMAGE, ATTACHMENT, CONTACT, DEPARTMENT, PHONE;

    /** Loại được làm cột của Chi tiết/Bảng. */
    public static final Set<WidgetType> TABLE_CHILDREN = Set.of(TEXT, TEXTAREA, NUMBER, AMOUNT, RADIO, CHECKBOX,
            DATE, DATE_RANGE, IMAGE, ATTACHMENT, CONTACT, DEPARTMENT, PHONE);

    /** Có giá trị số mà công thức / điều kiện đọc được (Khoảng ngày: thời lượng). */
    public boolean numeric() {
        return this == NUMBER || this == AMOUNT || this == FORMULA || this == DATE_RANGE;
    }

    /** Chọn một / chọn nhiều: điều kiện so theo id phương án. */
    public boolean choice() {
        return this == RADIO || this == CHECKBOX;
    }

    /** Có ô nhập (Mô tả chỉ là chữ tĩnh, Công thức tự tính). */
    public boolean input() {
        return this != DESCRIPTION && this != FORMULA;
    }

    public boolean files() {
        return this == IMAGE || this == ATTACHMENT;
    }
}
