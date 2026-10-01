package com.kpitracking.ai.document.model;

import java.util.List;

/**
 * Một MỤC của tài liệu sau khi cắt — đơn vị để bóc tiêu chí từng mục và để nạp kho tri thức.
 *
 * @param path   đường dẫn tiêu đề từ gốc, vd ["CHƯƠNG IV. ĐÁNH GIÁ", "Điều 10. Đánh giá kết quả công việc"]
 *               hoặc ["PHẦN 2. BẮT ĐẦU", "2.4. Trang Tổng quan"]
 * @param text   toàn bộ chữ của mục (không gồm dòng tiêu đề của chính nó ở mục cắt theo tiêu đề)
 * @param images ảnh của mục, theo thứ tự xuất hiện
 */
public record DocumentSection(List<String> path, String text, List<Block.Picture> images) {

    public DocumentSection(List<String> path, String text) {
        this(path, text, List.of());
    }

    /** Tiêu đề của chính mục (phần tử cuối của đường dẫn). */
    public String title() {
        return path.isEmpty() ? "" : path.get(path.size() - 1);
    }

    /** Tiêu đề cha liền trên (chương, phần…), rỗng nếu không có. */
    public String parent() {
        return path.size() < 2 ? "" : path.get(path.size() - 2);
    }

    /** Nhãn đầy đủ để hiện cho người dùng: "CHƯƠNG IV. … › Điều 10. …". */
    public String label() {
        return String.join(" › ", path);
    }

    public boolean isBlank() {
        return text.isBlank() && images.isEmpty();
    }
}
