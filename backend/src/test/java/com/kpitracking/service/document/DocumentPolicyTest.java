package com.kpitracking.service.document;

import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DocumentPolicyTest {

    static byte[] docx() throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText("Quy chế");
            doc.write(out);
            return out.toByteArray();
        }
    }

    static byte[] zipWith(String... entries) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (String e : entries) {
                zip.putNextEntry(new ZipEntry(e));
                zip.write("x".getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }

    static ErrorCode codeOf(Runnable r) {
        try {
            r.run();
        } catch (BusinessException e) {
            return e.getErrorCode();
        }
        return null;
    }

    @Test
    @DisplayName("DOCX và PDF thật: nhận, chuẩn hoá kiểu MIME")
    void acceptsRealFiles() throws Exception {
        var d = DocumentPolicy.check("Quy che.docx", "application/octet-stream", docx());
        assertThat(d.extension()).isEqualTo("docx");
        assertThat(d.contentType()).contains("wordprocessingml");

        var p = DocumentPolicy.check("a.pdf", "application/pdf", "%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII));
        assertThat(p.contentType()).isEqualTo("application/pdf");
    }

    @Test
    @DisplayName("DOCX mang macro (docm đổi tên) bị chặn")
    void rejectsMacroDocx() throws Exception {
        byte[] docm = zipWith("[Content_Types].xml", "word/document.xml", "word/vbaProject.bin");
        assertThat(codeOf(() -> DocumentPolicy.check("x.docx", null, docm))).isEqualTo(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED);
    }

    @Test
    @DisplayName("ZIP không phải DOCX, đuôi lạ, nội dung giả đuôi, MIME khai sai đều bị chặn")
    void rejectsFakes() throws Exception {
        assertThat(codeOf(() -> DocumentPolicy.check("x.docx", null, rethrow(() -> zipWith("a.txt")))))
                .isEqualTo(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED);
        assertThat(codeOf(() -> DocumentPolicy.check("x.exe", null, new byte[]{1, 2, 3, 4})))
                .isEqualTo(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED);
        assertThat(codeOf(() -> DocumentPolicy.check("x.pdf", null, "MZ....".getBytes(StandardCharsets.US_ASCII))))
                .isEqualTo(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED);
        assertThat(codeOf(() -> DocumentPolicy.check("x.pdf", "image/png", "%PDF-1.7".getBytes(StandardCharsets.US_ASCII))))
                .isEqualTo(ErrorCode.DOCUMENT_FILE_TYPE_NOT_ALLOWED);
    }

    @Test
    @DisplayName("tệp rỗng và tệp quá 10MB")
    void sizeLimits() {
        assertThat(codeOf(() -> DocumentPolicy.check("a.pdf", null, new byte[0]))).isEqualTo(ErrorCode.FILE_EMPTY);
        byte[] big = new byte[(int) DocumentPolicy.MAX_FILE_BYTES + 1];
        big[0] = 0x25; big[1] = 0x50; big[2] = 0x44; big[3] = 0x46;
        assertThat(codeOf(() -> DocumentPolicy.check("a.pdf", null, big))).isEqualTo(ErrorCode.DOCUMENT_FILE_TOO_LARGE);
    }

    @Test
    @DisplayName("tên tệp: bỏ đường dẫn máy người dùng, cắt dài nhưng giữ đuôi")
    void safeFileName() {
        assertThat(DocumentPolicy.safeFileName("C:\\Users\\a\\..\\quy-che.pdf")).isEqualTo("quy-che.pdf");
        String longName = "a".repeat(300) + ".docx";
        String safe = DocumentPolicy.safeFileName(longName);
        assertThat(safe).hasSize(120).endsWith(".docx");
        assertThat(DocumentPolicy.defaultTitle("Quy che luong.pdf")).isEqualTo("Quy che luong");
    }

    interface ThrowingSupplier<T> { T get() throws Exception; }

    static <T> T rethrow(ThrowingSupplier<T> s) {
        try {
            return s.get();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
