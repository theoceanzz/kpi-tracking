package com.kpitracking.ai.rag;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Đọc tệp của thư viện tài liệu thành các mục ({@link DocxSectionWalker.Section}) để nạp vào kho tri thức.
 * Một khuôn đầu ra cho mọi loại tệp, nên phần cắt đoạn/embedding phía sau không cần biết tệp là gì.
 *
 * <ul>
 *   <li><b>DOCX</b> — {@link DocxSectionWalker}: giữ cây tiêu đề và ảnh.</li>
 *   <li><b>PDF</b> — PDFBox, mỗi trang một mục ({@code [tiêu đề tài liệu, "Trang n"]}). PDF không mang cây
 *       tiêu đề đáng tin như DOCX; chia theo trang giữ được chỗ để người dùng tra lại. Không lấy ảnh.</li>
 * </ul>
 *
 * <p>Không có chữ nào (PDF scan) thì ném {@link NoTextException} — tài liệu thành {@code UNSUPPORTED}, không
 * thử lại, và người dùng thấy rõ lý do thay vì tưởng AI đã "học" tài liệu đó.
 */
public final class DocumentParser {

    private DocumentParser() {}

    /** Tệp đọc được nhưng không có lớp chữ. */
    public static class NoTextException extends Exception {
        public NoTextException() {
            super("Tài liệu không có chữ để nạp");
        }
    }

    /**
     * @param extension đuôi không dấu chấm ({@code docx}, {@code pdf}) — đã qua {@code DocumentPolicy}
     * @param title     tiêu đề tài liệu, làm gốc đường dẫn mục cho PDF
     * @param withImages giữ ảnh (chỉ DOCX). Tài liệu PERSONAL/UNIT không bóc ảnh ở P1 vì kho ảnh là công khai.
     */
    public static List<DocxSectionWalker.Section> parse(byte[] bytes, String extension, String title, boolean withImages)
            throws IOException, NoTextException {
        List<DocxSectionWalker.Section> sections = switch (extension.toLowerCase(Locale.ROOT)) {
            case "docx" -> docx(bytes, withImages);
            case "pdf" -> pdf(bytes, title);
            default -> throw new IOException("Loại tệp chưa hỗ trợ: " + extension);
        };
        List<DocxSectionWalker.Section> nonBlank = sections.stream().filter(s -> !s.text().isBlank()).toList();
        if (nonBlank.isEmpty()) throw new NoTextException();
        return nonBlank;
    }

    private static List<DocxSectionWalker.Section> docx(byte[] bytes, boolean withImages) throws IOException {
        List<DocxSectionWalker.Section> sections = DocxSectionWalker.walk(new ByteArrayInputStream(bytes));
        if (withImages) return sections;
        return sections.stream()
                .map(s -> new DocxSectionWalker.Section(s.path(), s.text(), List.of()))
                .toList();
    }

    private static List<DocxSectionWalker.Section> pdf(byte[] bytes, String title) throws IOException {
        List<DocxSectionWalker.Section> out = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            int pages = doc.getNumberOfPages();
            for (int p = 1; p <= pages; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                String text = normalize(stripper.getText(doc));
                if (text.isBlank()) continue;
                out.add(new DocxSectionWalker.Section(List.of(title, "Trang " + p), text, List.of()));
            }
        }
        return out;
    }

    /** Gộp dòng trắng liên tiếp, bỏ khoảng trắng cuối dòng — PDF hay sinh rất nhiều cả hai. */
    static String normalize(String text) {
        if (text == null) return "";
        return text.replace("\r", "")
                .replaceAll("[ \\t]+\\n", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }
}
