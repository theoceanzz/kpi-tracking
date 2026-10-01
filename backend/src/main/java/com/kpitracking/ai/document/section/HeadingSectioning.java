package com.kpitracking.ai.document.section;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.DocumentSection;
import com.kpitracking.ai.document.model.ParsedDocument;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

/**
 * Cắt theo TIÊU ĐỀ (Heading 1..6): mỗi tiêu đề mở một mục mới, đường dẫn mục = các tiêu đề đang mở theo
 * cấp ("PHẦN 2. BẮT ĐẦU" › "2.4. Trang Tổng quan"). Ảnh gắn vào mục đang mở. Không có tiêu đề nào thì cả tài
 * liệu là một mục (bộ cắt đoạn phía sau lo phần còn lại). Tách từ {@code DocxSectionWalker} cũ — cùng kết quả.
 */
@Slf4j
public final class HeadingSectioning implements SectioningStrategy {

    public static final HeadingSectioning INSTANCE = new HeadingSectioning();

    private HeadingSectioning() {}

    @Override
    public String name() {
        return "heading";
    }

    @Override
    public List<DocumentSection> sections(ParsedDocument doc) {
        List<DocumentSection> out = new ArrayList<>();
        List<String> path = new ArrayList<>();       // tiêu đề đang mở theo cấp
        StringBuilder text = new StringBuilder();
        List<Block.Picture> images = new ArrayList<>();

        for (Block b : doc.blocks()) {
            if (b instanceof Block.Heading h) {
                flush(out, path, text, images);
                // Tiêu đề cấp n thay thế mọi tiêu đề từ cấp n trở xuống đang mở.
                while (path.size() >= h.level()) path.remove(path.size() - 1);
                path.add(h.text());
            } else if (b instanceof Block.Picture p) {
                images.add(p);
            } else {
                String line = ParsedDocument.lineOf(b);
                if (line != null && !line.isBlank()) appendLine(text, line);
            }
        }
        flush(out, path, text, images);
        log.info("Cắt theo tiêu đề «{}»: {} mục, {} ảnh", doc.fileName(), out.size(),
                out.stream().mapToInt(s -> s.images().size()).sum());
        return out;
    }

    private static void flush(List<DocumentSection> out, List<String> path, StringBuilder text, List<Block.Picture> images) {
        DocumentSection s = new DocumentSection(List.copyOf(path), text.toString().trim(), List.copyOf(images));
        if (!s.isBlank()) out.add(s);
        text.setLength(0);
        images.clear();
    }

    private static void appendLine(StringBuilder sb, String line) {
        if (!sb.isEmpty()) sb.append('\n');
        sb.append(line);
    }
}
