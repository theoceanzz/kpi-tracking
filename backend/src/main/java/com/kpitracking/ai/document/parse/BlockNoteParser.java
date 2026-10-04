package com.kpitracking.ai.document.parse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Tài liệu soạn trực tuyến ({@code .kgdoc}): mảng khối JSON của trình soạn BlockNote. Giữ cấu trúc như
 * {@link DocxParser} — tiêu đề có cấp, đoạn, mục danh sách, dòng bảng — để cắt mục theo tiêu đề y như tệp Word.
 *
 * <p>Khối: {@code {type, props, content, children}}. {@code content} là mảng chữ ({@code text} / {@code link} lồng chữ),
 * hoặc với bảng là {@code {type: "tableContent", rows: [{cells: [...]}]}}. Khối con (mục lồng, khối trong khối gập)
 * đọc nối tiếp sau khối cha. Định dạng (màu, đậm…) không mang nghĩa cho AI nên bỏ.
 */
@Component
public class BlockNoteParser implements DocumentParser {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> LIST_ITEMS = Set.of("bulletListItem", "numberedListItem", "checkListItem", "toggleListItem");

    @Override
    public Set<String> formats() {
        return Set.of("kgdoc");
    }

    @Override
    public boolean accepts(FileRef file) {
        return formats().contains(file.extension());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        JsonNode root = JSON.readTree(file.bytes());
        if (root == null || !root.isArray()) throw new Unparseable("không phải tài liệu soạn trực tuyến");
        List<Block> out = new ArrayList<>();
        walk(root, out);
        if (out.isEmpty()) throw new Unparseable("tài liệu trống");
        return new ParsedDocument(file.name(), "kgdoc", out, ParsedDocument.TextSource.TEXT, false, null);
    }

    private static void walk(JsonNode blocks, List<Block> out) {
        for (JsonNode b : blocks) {
            String type = b.path("type").asText();
            JsonNode content = b.path("content");
            if ("table".equals(type)) {
                for (JsonNode row : content.path("rows")) {
                    List<String> cells = new ArrayList<>();
                    for (JsonNode cell : row.path("cells")) {
                        // Ô kiểu mới là {type: "tableCell", content: [...]}, kiểu cũ là thẳng mảng chữ.
                        cells.add(text(cell.isArray() ? cell : cell.path("content")).strip());
                    }
                    if (cells.stream().anyMatch(c -> !c.isEmpty())) out.add(new Block.TableRow(cells));
                }
            } else {
                String text = text(content).strip();
                if ("image".equals(type) || "video".equals(type) || "audio".equals(type) || "file".equals(type)) {
                    text = b.path("props").path("caption").asText("").strip();
                }
                if (!text.isEmpty()) {
                    if ("heading".equals(type)) {
                        out.add(new Block.Heading(Math.max(1, Math.min(6, b.path("props").path("level").asInt(1))), text));
                    } else if ("checkListItem".equals(type)) {
                        out.add(new Block.Paragraph((b.path("props").path("checked").asBoolean() ? "[x] " : "[ ] ") + text, true));
                    } else {
                        out.add(new Block.Paragraph(text, LIST_ITEMS.contains(type)));
                    }
                }
            }
            if (b.path("children").isArray()) walk(b.path("children"), out);
        }
    }

    /** Ghép chữ của một mảng nội dung nội dòng (chữ, liên kết lồng chữ, mention…). */
    private static String text(JsonNode inline) {
        if (inline == null || !inline.isArray()) return "";
        StringBuilder sb = new StringBuilder();
        for (JsonNode n : inline) {
            if (n.has("text")) sb.append(n.path("text").asText());
            else if (n.path("content").isArray()) sb.append(text(n.path("content")));
        }
        return sb.toString();
    }
}
