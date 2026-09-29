package com.kpitracking.service.ai.review.evidence;

import com.kpitracking.ai.document.fetch.DocumentFetcher;
import com.kpitracking.ai.document.parse.DocParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import com.kpitracking.ai.document.parse.DocxParser;
import com.kpitracking.ai.document.parse.ImageParser;
import com.kpitracking.ai.document.parse.ParserRegistry;
import com.kpitracking.ai.document.parse.PdfParser;
import com.kpitracking.ai.document.parse.SpreadsheetParser;
import com.kpitracking.ai.document.parse.TextParser;
import com.kpitracking.ai.document.parse.VisionReader;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Ba luật đọc minh chứng: không im lặng (tệp không đọc được có lý do), cắt có kiểm soát (ghi đã đọc tới đâu),
 * và chữ lấy từ ảnh đánh dấu IMAGE. Tệp Word / Excel / PDF dựng ngay trong test bằng chính thư viện đọc.
 */
class EvidenceReaderTest {

    private DocumentFetcher fetcher;
    private VisionReader vision;
    private EvidenceReader reader;

    @BeforeEach
    void setUp() {
        fetcher = mock(DocumentFetcher.class);
        vision = mock(VisionReader.class);
        PdfParser pdf = new PdfParser();
        ParserRegistry registry = new ParserRegistry(List.of(new DocxParser(), new DocParser(), new SpreadsheetParser(),
                new ImageParser(vision), new TextParser(), pdf));
        reader = new EvidenceReader(fetcher, new DocumentReader(registry, pdf, vision));
        when(vision.enabled()).thenReturn(true);
    }

    private static byte[] docx(String... paragraphs) throws IOException {
        try (XWPFDocument d = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (String p : paragraphs) d.createParagraph().createRun().setText(p);
            d.write(out);
            return out.toByteArray();
        }
    }

    private static byte[] xlsx() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Doanh thu");
            var head = sheet.createRow(0);
            head.createCell(0).setCellValue("Tháng");
            head.createCell(1).setCellValue("Doanh thu");
            var row = sheet.createRow(1);
            row.createCell(0).setCellValue("Tháng 9");
            row.createCell(1).setCellValue(1200);
            wb.write(out);
            return out.toByteArray();
        }
    }

    /** {@code text == null} → trang trắng, như một bản scan không có lớp chữ. */
    private static byte[] pdf(String text) throws IOException {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            if (text != null) {
                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                    cs.beginText();
                    cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                    cs.newLineAtOffset(50, 700);
                    cs.showText(text);
                    cs.endText();
                }
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    @Test
    @DisplayName("Word: bóc đủ các đoạn, nguồn TEXT")
    void readsWord() throws Exception {
        EvidenceText t = reader.readBytes("bao-cao.docx", docx("Báo cáo tháng 9", "Hoàn thành 12 hợp đồng"));

        assertThat(t.readable()).isTrue();
        assertThat(t.source()).isEqualTo(EvidenceText.Source.TEXT);
        assertThat(t.text()).contains("Báo cáo tháng 9").contains("Hoàn thành 12 hợp đồng");
    }

    @Test
    @DisplayName("Excel: có tên sheet, tiêu đề cột và số")
    void readsSpreadsheet() throws Exception {
        EvidenceText t = reader.readBytes("so-lieu.xlsx", xlsx());

        assertThat(t.readable()).isTrue();
        assertThat(t.text()).contains("Doanh thu").contains("Tháng 9").contains("1200");
    }

    @Test
    @DisplayName("PDF có lớp chữ: đọc tại chỗ, không gọi mô hình đọc ảnh")
    void readsTextPdf() throws Exception {
        String line = "Monthly report: 12 contracts signed, revenue 1.2 billion VND, all tasks delivered on time.";
        EvidenceText t = reader.readBytes("report.pdf", pdf(line));

        assertThat(t.readable()).isTrue();
        assertThat(t.source()).isEqualTo(EvidenceText.Source.TEXT);
        assertThat(t.text()).contains("12 contracts signed");
        verify(vision, never()).transcribe(anyList(), anyString());
    }

    @Test
    @DisplayName("PDF scan: chuyển sang mô hình đọc ảnh, chữ đánh dấu IMAGE")
    void scannedPdfGoesToVision() throws Exception {
        when(vision.transcribe(anyList(), eq("image/png"))).thenReturn("Biên bản nghiệm thu số 07");

        EvidenceText t = reader.readBytes("scan.pdf", pdf(null));

        assertThat(t.readable()).isTrue();
        assertThat(t.source()).isEqualTo(EvidenceText.Source.IMAGE);
        assertThat(t.text()).contains("Biên bản nghiệm thu số 07");
    }

    @Test
    @DisplayName("PDF scan khi TẮT đọc ảnh: không đọc được, lý do nói rõ")
    void scannedPdfWithoutVisionIsListed() throws Exception {
        when(vision.enabled()).thenReturn(false);

        EvidenceText t = reader.readBytes("scan.pdf", pdf(null));

        assertThat(t.readable()).isFalse();
        assertThat(t.unreadableReason()).contains("không có lớp chữ").contains("chưa bật đọc ảnh");
    }

    @Test
    @DisplayName("ảnh: mô hình đọc ảnh lỗi -> không đọc được, không ném ra ngoài")
    void visionFailureIsAReason() {
        when(vision.transcribe(anyList(), any())).thenThrow(new RuntimeException("503"));

        EvidenceText t = reader.readBytes("anh.jpg", new byte[]{1, 2, 3});

        assertThat(t.readable()).isFalse();
        assertThat(t.unreadableReason()).contains("mô hình đọc ảnh lỗi");
    }

    @Test
    @DisplayName("định dạng lạ / tệp hỏng / tải lỗi -> đều có lý do riêng")
    void everyFailureHasAReason() throws Exception {
        assertThat(reader.read("video.mp4", "https://x/video.mp4").unreadableReason()).contains(".mp4 chưa hỗ trợ");
        assertThat(reader.readBytes("hong.docx", new byte[]{1, 2, 3}).unreadableReason()).contains("tệp hỏng");

        when(fetcher.fetch("https://x/to.docx")).thenThrow(new IOException("tệp lớn hơn giới hạn đọc"));
        assertThat(reader.read("to.docx", "https://x/to.docx").unreadableReason()).isEqualTo("tệp lớn hơn giới hạn đọc");
    }

    @Test
    @DisplayName("tệp dài: cắt ở trần và ghi đã đọc bao nhiêu")
    void capsLongFiles() throws Exception {
        EvidenceText t = reader.readBytes("dai.docx", docx("x".repeat(500)), 100);

        assertThat(t.truncated()).isTrue();
        assertThat(t.text()).contains("[đã cắt: đọc 100/");
    }
}
