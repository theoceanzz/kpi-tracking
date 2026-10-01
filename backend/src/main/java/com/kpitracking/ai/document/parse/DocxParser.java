package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.Block;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFPicture;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Word {@code .docx} bằng XWPF, GIỮ cấu trúc: tiêu đề (Heading 1..6 / Title), đoạn, gạch đầu dòng, dòng bảng,
 * ảnh kèm chú thích "Hình n…" ngay sau ảnh. Mục lục (style TOC) bỏ qua.
 *
 * <p>Không dùng {@code ApachePoiDocumentParser} của langchain4j: nó trả một khối chữ phẳng — mất tiêu đề, ảnh,
 * bảng, mà với tài liệu hướng dẫn tiêu đề CHÍNH LÀ cấu trúc và ảnh chụp màn hình là phần giá trị nhất.
 * (Tách từ {@code DocxSectionWalker} cũ; phần gom mục nay ở {@code HeadingSectioning}.)
 */
@Component
public class DocxParser implements DocumentParser {

    @Override
    public Set<String> formats() {
        return Set.of("docx");
    }

    @Override
    public boolean accepts(FileRef file) {
        String ext = file.extension();
        // .doc mà nội dung là zip → thật ra là .docx đổi tên.
        return ext.equals("docx") && !DocumentParser.isOle2(file.bytes())
                || ext.equals("doc") && DocumentParser.isZip(file.bytes());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(file.bytes()))) {
            ParsedDocument parsed = new ParsedDocument(file.name(), "docx", blocks(doc),
                    ParsedDocument.TextSource.TEXT, false, null);
            if (parsed.isEmpty()) throw new Unparseable("tài liệu Word không có chữ (có thể chỉ chứa ảnh)");
            return parsed;
        }
    }

    static List<Block> blocks(XWPFDocument doc) {
        List<Block> out = new ArrayList<>();
        List<IBodyElement> elements = doc.getBodyElements();
        for (int i = 0; i < elements.size(); i++) {
            IBodyElement el = elements.get(i);
            if (el instanceof XWPFParagraph p) {
                int level = headingLevel(p);
                if (level > 0) {
                    out.add(new Block.Heading(level, p.getText().trim()));
                    continue;
                }
                if (isToc(p)) continue;

                List<Block.Picture> found = picturesOf(p);
                if (!found.isEmpty()) {
                    String caption = captionAfter(elements, i);
                    for (Block.Picture img : found) out.add(new Block.Picture(img.bytes(), img.fileName(), caption));
                    // Chú thích cũng là chữ đáng tìm ("Hình 3. Màn hình đăng nhập") — một lần cho cả đoạn ảnh.
                    if (caption != null) out.add(new Block.Paragraph(caption));
                    continue;
                }

                String line = p.getText();
                if (line == null || line.isBlank()) continue;
                if (isCaption(line) && i > 0 && !picturesOf(elements.get(i - 1)).isEmpty()) {
                    continue;   // đã lấy làm chú thích ở vòng trước
                }
                out.add(new Block.Paragraph(line.trim(), isListItem(p)));

            } else if (el instanceof XWPFTable t) {
                for (XWPFTableRow row : t.getRows()) {
                    List<String> cells = row.getTableCells().stream().map(c -> c.getText().trim()).toList();
                    if (cells.stream().anyMatch(c -> !c.isEmpty())) out.add(new Block.TableRow(cells));
                }
            }
        }
        return out;
    }

    /** 1..6 cho Heading 1..6 (cả tên kiểu "Heading1"), 1 cho Title; 0 nếu không phải tiêu đề. */
    static int headingLevel(XWPFParagraph p) {
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

    private static List<Block.Picture> picturesOf(IBodyElement el) {
        if (!(el instanceof XWPFParagraph p)) return List.of();
        List<Block.Picture> out = new ArrayList<>();
        for (XWPFRun run : p.getRuns()) {
            for (XWPFPicture pic : run.getEmbeddedPictures()) {
                var data = pic.getPictureData();
                if (data == null) continue;
                String name = data.getFileName() != null ? data.getFileName() : "image." + data.suggestFileExtension();
                out.add(new Block.Picture(data.getData(), name, null));
            }
        }
        return out;
    }
}
