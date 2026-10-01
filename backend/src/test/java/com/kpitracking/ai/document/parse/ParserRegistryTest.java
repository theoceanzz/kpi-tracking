package com.kpitracking.ai.document.parse;

import com.kpitracking.ai.document.model.FileRef;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Chọn parser theo đuôi tệp CỘNG nội dung đầu tệp — người dùng hay đổi tên tệp. */
class ParserRegistryTest {

    private final ParserRegistry registry = new ParserRegistry(List.of(new DocxParser(), new DocParser(),
            new SpreadsheetParser(), new ImageParser(mock(VisionReader.class)), new TextParser(), new PdfParser()));

    private static final byte[] ZIP = {'P', 'K', 3, 4};
    private static final byte[] OLE = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};
    private static final byte[] PDF = {'%', 'P', 'D', 'F', '-', '1'};

    private Class<?> pick(String name, byte[] bytes) {
        return registry.forFile(FileRef.of(name, bytes)).map(Object::getClass).orElse(null);
    }

    @Test
    @DisplayName("theo đuôi: docx/doc/xlsx/pdf/png/txt; đuôi lạ → không có parser")
    void byExtension() {
        assertThat(pick("a.docx", ZIP)).isEqualTo(DocxParser.class);
        assertThat(pick("a.doc", OLE)).isEqualTo(DocParser.class);
        assertThat(pick("a.xlsx", ZIP)).isEqualTo(SpreadsheetParser.class);
        assertThat(pick("a.pdf", PDF)).isEqualTo(PdfParser.class);
        assertThat(pick("a.png", new byte[]{1})).isEqualTo(ImageParser.class);
        assertThat(pick("a.md", new byte[]{1})).isEqualTo(TextParser.class);
        assertThat(pick("a.mp4", new byte[]{1})).isNull();
    }

    @Test
    @DisplayName("đuôi sai: .doc thật ra là zip → Docx; .docx là OLE → Doc; tệp nào nội dung '%PDF' → Pdf")
    void byContent() {
        assertThat(pick("a.doc", ZIP)).isEqualTo(DocxParser.class);
        assertThat(pick("a.docx", OLE)).isEqualTo(DocParser.class);
        assertThat(pick("a.docx", PDF)).isEqualTo(PdfParser.class);
    }

    @Test
    @DisplayName("danh sách định dạng nhận được — để kiểm tệp tải lên và hiện cho người dùng")
    void formats() {
        assertThat(registry.formats()).contains("docx", "doc", "pdf", "xlsx", "xls", "png", "jpg", "txt");
    }
}
