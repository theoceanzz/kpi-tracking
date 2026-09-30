package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * PDF có lớp chữ bằng PDFBox, chạy tại chỗ. PDF scan (không có lớp chữ) ném {@link Unparseable} để
 * {@link DocumentReader} chuyển sang mô hình đọc ảnh — {@link #renderPages} vẽ vài trang đầu thành ảnh.
 *
 * <p>Nhận ra "PDF scan" bằng mật độ chữ: dưới {@link #MIN_CHARS_PER_PAGE} ký tự mỗi trang là ảnh có vài dòng
 * đầu trang, không phải tài liệu chữ. PDF không có kiểu tiêu đề như Word nên mỗi dòng là một đoạn; cắt mục
 * theo cấu trúc chữ ("Điều 3.", "CHƯƠNG II") do {@code LegalStructureSectioning} lo.
 */
@Component
public class PdfParser implements DocumentParser {

    static final int MIN_CHARS_PER_PAGE = 40;
    static final int MAX_PAGES = 30;

    @Override
    public Set<String> formats() {
        return Set.of("pdf");
    }

    @Override
    public boolean accepts(FileRef file) {
        return file.extension().equals("pdf") || DocumentParser.isPdf(file.bytes());
    }

    @Override
    public ParsedDocument parse(FileRef file) throws Exception {
        try (PDDocument doc = Loader.loadPDF(file.bytes())) {
            int pages = doc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setEndPage(Math.min(pages, MAX_PAGES));
            String text = stripper.getText(doc)
                    // Glyph không có mã Unicode (ô tích Wingdings trong biểu mẫu) — PDFBox trả U+FFFF.
                    .replace('￿', '☐')
                    .replaceAll("[ \\t]+\\n", "\n").replaceAll("\\n{3,}", "\n\n").strip();
            int readPages = Math.max(1, Math.min(pages, MAX_PAGES));
            if (text.replaceAll("\\s", "").length() < MIN_CHARS_PER_PAGE * readPages) {
                throw new Unparseable("PDF không có lớp chữ (bản scan / ảnh)");
            }
            boolean truncated = pages > MAX_PAGES;
            return ParsedDocument.fromText(file.name(), "pdf", text, ParsedDocument.TextSource.TEXT, truncated,
                    truncated ? "… (chỉ đọc " + MAX_PAGES + "/" + pages + " trang đầu)" : null);
        }
    }

    /** Vẽ tối đa {@code maxPages} trang đầu thành PNG — cho mô hình đọc ảnh khi PDF là bản scan. */
    public List<byte[]> renderPages(byte[] bytes, int maxPages, float dpi) throws Exception {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            List<byte[]> out = new ArrayList<>();
            for (int i = 0; i < Math.min(doc.getNumberOfPages(), maxPages); i++) {
                BufferedImage img = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                ImageIO.write(img, "png", buf);
                out.add(buf.toByteArray());
            }
            return out;
        }
    }

    /** Số trang — để ghi rõ đã đọc tới đâu khi chỉ đọc ảnh vài trang đầu. */
    public int pageCount(byte[] bytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            return doc.getNumberOfPages();
        }
    }
}
