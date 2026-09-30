package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Cửa đọc tệp duy nhất của hệ thống (Façade): chọn parser qua {@link ParserRegistry}, và khi PDF là bản scan
 * thì chuyển sang mô hình đọc ảnh cho vài trang đầu. Dùng chung cho kho tri thức, bộ tiêu chí và minh chứng
 * bài nộp — trước đây mỗi nơi một bộ đọc riêng.
 */
@Component
@Slf4j
public class DocumentReader {

    private final ParserRegistry registry;
    private final PdfParser pdf;
    private final VisionReader vision;

    @Value("${app.ai.vision.max-pdf-pages:3}")
    int maxScanPages = 3;

    public DocumentReader(ParserRegistry registry, PdfParser pdf, VisionReader vision) {
        this.registry = registry;
        this.pdf = pdf;
        this.vision = vision;
    }

    public Set<String> formats() {
        return registry.formats();
    }

    public boolean supports(FileRef file) {
        return registry.forFile(file).isPresent();
    }

    /**
     * @throws DocumentParser.Unparseable định dạng chưa hỗ trợ / không có chữ — thông điệp là lý do cho người dùng
     * @throws Exception                  tệp hỏng, có mật khẩu…
     */
    public ParsedDocument read(FileRef file) throws Exception {
        DocumentParser parser = registry.forFile(file)
                .orElseThrow(() -> new DocumentParser.Unparseable("định dạng ." + file.extension() + " chưa hỗ trợ đọc"));
        try {
            return parser.parse(file);
        } catch (DocumentParser.Unparseable u) {
            if (parser instanceof PdfParser) return readScannedPdf(file, u.getMessage());
            throw u;
        }
    }

    /** PDF scan: vẽ vài trang đầu thành ảnh, mô hình đọc ảnh chép lại (nguồn IMAGE). */
    private ParsedDocument readScannedPdf(FileRef file, String reason) throws DocumentParser.Unparseable {
        if (!vision.enabled()) throw new DocumentParser.Unparseable(reason + " — chưa bật đọc ảnh");
        try {
            int pages = pdf.pageCount(file.bytes());
            List<byte[]> images = pdf.renderPages(file.bytes(), maxScanPages, 110f);
            String text = vision.transcribe(images, "image/png");
            if (text == null) throw new DocumentParser.Unparseable("ảnh không có chữ");
            boolean truncated = pages > maxScanPages;
            return ParsedDocument.fromText(file.name(), "pdf", text, ParsedDocument.TextSource.IMAGE, truncated,
                    truncated ? "(chỉ đọc ảnh " + maxScanPages + "/" + pages + " trang đầu)" : null);
        } catch (DocumentParser.Unparseable u) {
            throw u;
        } catch (Exception e) {
            log.warn("Không đọc được PDF scan {}: {}", file.name(), e.toString());
            throw new DocumentParser.Unparseable("không đọc được ảnh (mô hình đọc ảnh lỗi)");
        }
    }
}
