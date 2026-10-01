package com.kpitracking.ai.document.model;

import java.util.List;

/**
 * Một khối nội dung của tài liệu đã đọc, giữ đủ cấu trúc để CẮT MỤC đúng cách: tiêu đề (cấp), đoạn, dòng
 * bảng, ảnh kèm chú thích. Định dạng nào không có cấu trúc (PDF, ảnh) thì chỉ có {@link Paragraph}.
 */
public sealed interface Block {

    /** Tiêu đề cấp {@code level} (1 = cao nhất). */
    record Heading(int level, String text) implements Block {}

    /** Một đoạn chữ; {@code listItem} = gạch đầu dòng / đánh số (khi ghép chữ thêm "- " ở đầu). */
    record Paragraph(String text, boolean listItem) implements Block {
        public Paragraph(String text) {
            this(text, false);
        }
    }

    /** Một dòng bảng (ô theo thứ tự). */
    record TableRow(List<String> cells) implements Block {}

    /** Ảnh nhúng, chưa tải lên đâu cả; {@code caption} lấy từ đoạn "Hình n…" ngay sau ảnh nếu có. */
    record Picture(byte[] bytes, String fileName, String caption) implements Block {}
}
