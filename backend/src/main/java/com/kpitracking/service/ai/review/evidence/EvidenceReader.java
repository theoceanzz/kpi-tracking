package com.kpitracking.service.ai.review.evidence;

import com.kpitracking.ai.document.fetch.DocumentFetcher;
import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.model.ParsedDocument;
import com.kpitracking.ai.document.parse.DocumentParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Đọc MỘT tệp minh chứng bài nộp thành chữ (Adapter trên {@link DocumentReader} của module tài liệu), theo đúng
 * ba luật của tài liệu phân tích mục 7.3:
 * <ol>
 *   <li><b>Không im lặng</b> — tệp nào không đọc được vẫn trả {@link EvidenceText} kèm lý do;</li>
 *   <li><b>Cắt có kiểm soát</b> — mỗi tệp tối đa {@code max-chars-per-file}, ghi rõ đã đọc tới đâu;</li>
 *   <li><b>Không trộn vào kho chung</b> — chữ bóc ra chỉ sống trong lượt phân tích (loại tài liệu
 *       {@code EVIDENCE} không nạp kho tri thức).</li>
 * </ol>
 */
@Component
@Slf4j
public class EvidenceReader {

    private final DocumentFetcher fetcher;
    private final DocumentReader reader;

    @Value("${app.ai.review.evidence.max-chars-per-file:6000}")
    int maxCharsPerFile = 6000;

    public EvidenceReader(DocumentFetcher fetcher, DocumentReader reader) {
        this.fetcher = fetcher;
        this.reader = reader;
    }

    public EvidenceText read(String fileName, String url) {
        FileRef probe = FileRef.of(fileName, new byte[0]);
        if (!reader.supports(probe)) {
            return EvidenceText.unreadable(fileName, "định dạng ." + probe.extension() + " chưa hỗ trợ đọc");
        }
        byte[] bytes;
        try {
            bytes = fetcher.fetch(url);
        } catch (IOException e) {
            // Lời của DocumentFetcher đã viết cho người đọc ("tệp lớn hơn giới hạn đọc", "HTTP 404"…).
            log.warn("Không tải được minh chứng {}: {}", fileName, e.getMessage());
            return EvidenceText.unreadable(fileName, e.getMessage() == null ? "không tải được tệp" : e.getMessage());
        } catch (Exception e) {
            log.warn("Không tải được minh chứng {}: {}", fileName, e.toString());
            return EvidenceText.unreadable(fileName, "không tải được tệp");
        }
        return readBytes(fileName, bytes);
    }

    /** Đọc nội dung đã có trong tay, cắt theo trần của minh chứng. */
    public EvidenceText readBytes(String fileName, byte[] bytes) {
        return readBytes(fileName, bytes, maxCharsPerFile);
    }

    public EvidenceText readBytes(String fileName, byte[] bytes, int maxChars) {
        try {
            ParsedDocument doc = reader.read(FileRef.of(fileName, bytes));
            EvidenceText.Source source = doc.source() == ParsedDocument.TextSource.IMAGE
                    ? EvidenceText.Source.IMAGE : EvidenceText.Source.TEXT;
            return cap(fileName, doc.plainText(), source, maxChars);
        } catch (DocumentParser.Unparseable u) {
            return EvidenceText.unreadable(fileName, u.getMessage());
        } catch (Exception e) {
            log.warn("Không bóc được chữ từ {}: {}", fileName, e.toString());
            return EvidenceText.unreadable(fileName, "tệp hỏng hoặc được bảo vệ bằng mật khẩu");
        }
    }

    private static EvidenceText cap(String fileName, String text, EvidenceText.Source source, int max) {
        if (text.length() <= max) return EvidenceText.read(fileName, text, source, false);
        String cut = text.substring(0, max) + "\n… [đã cắt: đọc " + max + "/" + text.length() + " ký tự]";
        return EvidenceText.read(fileName, cut, source, true);
    }
}
