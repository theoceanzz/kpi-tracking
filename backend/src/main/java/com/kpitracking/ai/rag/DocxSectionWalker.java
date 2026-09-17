package com.kpitracking.ai.rag;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Cắt một tệp .docx thành các MỤC theo tiêu đề, giữ lại ảnh và chú thích của từng mục.
 *
 * <p><b>Vì sao không dùng {@code ApachePoiDocumentParser} của langchain4j.</b> Nó trả về một khối
 * chữ phẳng: mất tiêu đề, mất ảnh, mất bảng. Với tài liệu hướng dẫn thì tiêu đề CHÍNH LÀ cấu trúc
 * ("2.4. Trang Tổng quan" là đơn vị người ta hỏi tới), còn ảnh chụp màn hình là thứ người dùng cần
 * nhìn thấy trong câu trả lời. Bỏ hai thứ đó là bỏ phần giá trị nhất của tài liệu.
 *
 * <p><b>Một mục = một đoạn Heading 2</b>, kèm Heading 1 làm đường dẫn cha. Tài liệu chỉ có Heading 1
 * (quy chế ngắn) thì mỗi Heading 1 là một mục. Không có tiêu đề nào thì cả tài liệu là một mục và
 * bộ cắt đệ quy phía sau sẽ lo phần còn lại.
 *
 * <p>Bảng được trải thành dòng "ô | ô | ô" — đủ để tìm kiếm và để model đọc, không cần giữ dạng bảng.
 * Ảnh gắn vào mục đang mở, chú thích lấy từ đoạn ngay sau ảnh nếu đoạn đó bắt đầu bằng "Hình".
 */
@Slf4j
public final class DocxSectionWalker {

    private DocxSectionWalker() {}

    /** Một ảnh bóc ra, chưa tải lên đâu cả. */
    public record Image(byte[] bytes, String fileName, String caption) {}

    /**
     * @param path     đường dẫn tiêu đề từ gốc, vd ["PHẦN 2. BẮT ĐẦU SỬ DỤNG", "2.4. Trang Tổng quan"]
     * @param text     toàn bộ chữ của mục (đoạn, gạch đầu dòng, bảng), KHÔNG gồm tiêu đề
     * @param images   ảnh theo thứ tự xuất hiện
     * @param captions chú thích tương ứng (có thể rỗng) — giữ riêng để đưa vào text tìm kiếm
     */
    public record Section(List<String> path, String text, List<Image> images) {
        public String title() {
            return path.isEmpty() ? "" : path.get(path.size() - 1);
        }

        public String parent() {
            return path.size() < 2 ? "" : path.get(path.size() - 2);
        }

        public boolean isBlank() {
            return text.isBlank() && images.isEmpty();
        }
    }

    public static List<Section> walk(InputStream in) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(in)) {
            return walk(doc);
        }
    }

    public static List<Section> walk(XWPFDocument doc) {
        List<Section> out = new ArrayList<>();
        List<String> path = new ArrayList<>();       // tiêu đề đang mở theo cấp
        StringBuilder text = new StringBuilder();
        List<Image> images = new ArrayList<>();
        List<IBodyElement> elements = doc.getBodyElements();

        for (int i = 0; i < elements.size(); i++) {
            IBodyElement el = elements.get(i);

            if (el instanceof XWPFParagraph p) {
                int level = headingLevel(p);
                if (level > 0) {
                    flush(out, path, text, images);
                    // Tiêu đề cấp n thay thế mọi tiêu đề từ cấp n trở xuống đang mở.
                    while (path.size() >= level) path.remove(path.size() - 1);
                    path.add(p.getText().trim());
                    continue;
                }
                if (isToc(p)) continue;

                List<Image> found = picturesOf(p);
                if (!found.isEmpty()) {
                    String caption = captionAfter(elements, i);
                    for (Image img : found) {
                        images.add(new Image(img.bytes(), img.fileName(), caption));
                    }
                    // Chú thích cũng là chữ đáng tìm ("Hình 3. Màn hình đăng nhập").
                    if (caption != null) appendLine(text, caption);
                    continue;
                }

                String line = p.getText();
                if (line == null || line.isBlank()) continue;
                if (isCaption(line) && i > 0 && !picturesOf(elements.get(i - 1)).isEmpty()) {
                    continue;   // đã lấy làm chú thích ở vòng trước
                }
                String prefix = isListItem(p) ? "- " : "";
                appendLine(text, prefix + line.trim());

            } else if (el instanceof XWPFTable t) {
                for (XWPFTableRow row : t.getRows()) {
                    StringBuilder line = new StringBuilder();
                    row.getTableCells().forEach(c -> {
                        if (line.length() > 0) line.append(" | ");
                        line.append(c.getText().trim());
                    });
                    if (!line.toString().isBlank()) appendLine(text, line.toString());
                }
            }
        }
        flush(out, path, text, images);
        log.info("Đọc docx: {} mục, {} ảnh", out.size(),
                out.stream().mapToInt(s -> s.images().size()).sum());
        return out;
    }

    // ── phụ trợ ─────────────────────────────────────────────────────────────

    private static void flush(List<Section> out, List<String> path, StringBuilder text, List<Image> images) {
        Section s = new Section(List.copyOf(path), text.toString().trim(), List.copyOf(images));
        if (!s.isBlank()) out.add(s);
        text.setLength(0);
        images.clear();
    }

    /** 1, 2, 3 cho Heading 1/2/3 (cả tên tiếng Anh lẫn kiểu "Heading1"); 0 nếu không phải tiêu đề. */
    private static int headingLevel(XWPFParagraph p) {
        String style = p.getStyle();
        if (style == null) return 0;
        String s = style.toLowerCase().replace(" ", "");
        if (s.startsWith("heading") && s.length() > 7) {
            char c = s.charAt(7);
            if (c >= '1' && c <= '6') return c - '0';
        }
        if (s.equals("title")) return 1;
        return 0;
    }

    private static boolean isToc(XWPFParagraph p) {
        String style = p.getStyle();
        return style != null && style.toLowerCase().startsWith("toc");
    }

    private static boolean isListItem(XWPFParagraph p) {
        if (p.getNumID() != null) return true;
        String style = p.getStyle();
        return style != null && style.toLowerCase().startsWith("list");
    }

    private static boolean isCaption(String line) {
        return line.trim().matches("^(Hình|Bảng|Figure|Table)\\s*\\d+.*");
    }

    private static String captionAfter(List<IBodyElement> elements, int i) {
        if (i + 1 >= elements.size()) return null;
        if (!(elements.get(i + 1) instanceof XWPFParagraph next)) return null;
        String t = next.getText();
        return t != null && isCaption(t) ? t.trim() : null;
    }

    private static List<Image> picturesOf(IBodyElement el) {
        if (!(el instanceof XWPFParagraph p)) return List.of();
        List<Image> out = new ArrayList<>();
        for (XWPFRun run : p.getRuns()) {
            for (XWPFPicture pic : run.getEmbeddedPictures()) {
                var data = pic.getPictureData();
                if (data == null) continue;
                String name = data.getFileName() != null ? data.getFileName()
                        : "image." + data.suggestFileExtension();
                out.add(new Image(data.getData(), name, null));
            }
        }
        return out;
    }

    private static void appendLine(StringBuilder sb, String line) {
        if (sb.length() > 0) sb.append('\n');
        sb.append(line);
    }
}
