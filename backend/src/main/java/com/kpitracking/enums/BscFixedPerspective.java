package com.kpitracking.enums;

/**
 * 4 lĩnh vực BSC kinh điển — CỐ ĐỊNH, không cho org thêm/xoá/đổi tên.
 * Đây là tầng phân loại (nhóm cha) cho các "Hạng mục" (entity {@code BscPerspective}):
 * mỗi hạng mục gán vào đúng 1 lĩnh vực cố định qua cột {@code fixed_perspective}.
 * Trọng số của lĩnh vực = tổng trọng số các hạng mục con (lĩnh vực không mang trọng số riêng).
 */
public enum BscFixedPerspective {
    FINANCIAL       ("Tài chính",            "#2563eb", 1),
    CUSTOMER        ("Khách hàng",           "#f59e0b", 2),
    INTERNAL_PROCESS("Quy trình nội bộ",     "#10b981", 3),
    LEARNING_GROWTH ("Học hỏi & phát triển", "#8b5cf6", 4);

    private final String displayName;
    private final String color;
    private final int displayOrder;

    BscFixedPerspective(String displayName, String color, int displayOrder) {
        this.displayName = displayName;
        this.color = color;
        this.displayOrder = displayOrder;
    }

    public String getDisplayName() { return displayName; }
    public String getColor() { return color; }
    public int getDisplayOrder() { return displayOrder; }
}
