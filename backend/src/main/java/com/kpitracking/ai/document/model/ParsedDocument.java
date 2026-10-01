package com.kpitracking.ai.document.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Tài liệu đã đọc xong, CHƯA cắt mục — đầu ra chung của mọi {@code DocumentParser}, đầu vào của mọi
 * {@code SectioningStrategy}.
 *
 * @param format    định dạng đã đọc (docx, pdf, xlsx…)
 * @param source    chữ lấy từ lớp chữ ({@code TEXT}) hay do mô hình đọc ảnh chép ({@code IMAGE} — có thể sai,
 *                  không bao giờ dùng để tính điểm)
 * @param truncated đã bỏ bớt (quá số trang / số dòng đọc được)
 * @param note      ghi chú đọc tới đâu, vd "(chỉ đọc ảnh 3/17 trang đầu)" — nối vào cuối {@link #plainText()}
 */
public record ParsedDocument(String fileName, String format, List<Block> blocks, TextSource source,
                             boolean truncated, String note) {

    public enum TextSource { TEXT, IMAGE }

    /** Tài liệu chỉ có chữ trơn (bản đã lưu trong CSDL, chữ mô hình chép từ ảnh…): mỗi dòng một đoạn. */
    public static ParsedDocument fromText(String fileName, String format, String text, TextSource source,
                                          boolean truncated, String note) {
        List<Block> blocks = new ArrayList<>();
        if (text != null) {
            for (String line : text.split("\\r?\\n")) {
                if (!line.isBlank()) blocks.add(new Block.Paragraph(line.strip()));
            }
        }
        return new ParsedDocument(fileName, format, blocks, source, truncated, note);
    }

    public static ParsedDocument fromText(String fileName, String text) {
        return fromText(fileName, "txt", text, TextSource.TEXT, false, null);
    }

    /** Toàn văn, mỗi khối một dòng: tiêu đề, đoạn ("- " cho gạch đầu dòng), bảng "ô | ô", chú thích ảnh. */
    public String plainText() {
        StringBuilder sb = new StringBuilder();
        for (Block b : blocks) {
            String line = lineOf(b);
            if (line != null && !line.isBlank()) sb.append(line).append('\n');
        }
        if (note != null && !note.isBlank()) sb.append(note).append('\n');
        return sb.toString().strip();
    }

    /**
     * Một khối thành một dòng chữ (dự án biên dịch Java 17 — chưa có switch theo pattern). Ảnh không thành
     * chữ: chú thích của ảnh đã là một {@link Block.Paragraph} riêng ngay sau (parser tự thêm).
     */
    public static String lineOf(Block b) {
        if (b instanceof Block.Heading h) return h.text();
        if (b instanceof Block.Paragraph p) return p.listItem() ? "- " + p.text() : p.text();
        if (b instanceof Block.TableRow r) return String.join(" | ", r.cells());
        return null;
    }

    public boolean hasHeadings() {
        return blocks.stream().anyMatch(b -> b instanceof Block.Heading);
    }

    public boolean isEmpty() {
        return plainText().isBlank() && blocks.stream().noneMatch(b -> b instanceof Block.Picture);
    }
}
