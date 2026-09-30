package com.kpitracking.ai.document.ingest;

import com.kpitracking.ai.document.model.FileRef;
import com.kpitracking.ai.document.parse.DocParser;
import com.kpitracking.ai.document.parse.DocumentReader;
import com.kpitracking.ai.document.parse.DocxParser;
import com.kpitracking.ai.document.parse.ImageParser;
import com.kpitracking.ai.document.parse.ParserRegistry;
import com.kpitracking.ai.document.parse.PdfParser;
import com.kpitracking.ai.document.parse.SpreadsheetParser;
import com.kpitracking.ai.document.parse.TextParser;
import com.kpitracking.ai.document.parse.VisionReader;
import com.kpitracking.ai.document.profile.DocumentKind;
import com.kpitracking.ai.document.profile.DocumentProfileRegistry;
import com.kpitracking.ai.document.profile.DocumentProfiles;
import com.kpitracking.ai.document.store.RagImageStore;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.repository.RagAssetRepository;
import com.kpitracking.repository.RagDocumentRepository;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.inmemory.InMemoryEmbeddingStore;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Đường nạp kho tri thức chung: đọc theo ĐỊNH DẠNG → cắt theo LOẠI tài liệu → làm giàu → lập chỉ mục. Embedding
 * giả (vector hằng) và kho trong bộ nhớ — test nói về phần "của KeyGo", không đo chất lượng vector.
 */
class DocumentIngestionPipelineTest {

    /** Vector hằng 3 chiều: đủ để kho nhận và tìm lại, không cần model thật. */
    private static final EmbeddingModel FAKE_EMBEDDING = new EmbeddingModel() {
        @Override
        public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
            return Response.from(segments.stream().map(s -> Embedding.from(new float[]{1f, 0f, 0f})).toList());
        }
    };

    private InMemoryEmbeddingStore<TextSegment> store;
    private DocumentIngestionPipeline pipeline;

    @BeforeEach
    void setUp() {
        RagDocumentRepository docs = mock(RagDocumentRepository.class);
        when(docs.save(any())).thenAnswer(inv -> {
            RagDocument d = inv.getArgument(0);
            if (d.getId() == null) d.setId(UUID.randomUUID());
            return d;
        });
        VisionReader vision = mock(VisionReader.class);   // tắt đọc ảnh
        PdfParser pdf = new PdfParser();
        DocumentReader reader = new DocumentReader(new ParserRegistry(List.of(new DocxParser(), new DocParser(),
                new SpreadsheetParser(), new ImageParser(vision), new TextParser(), pdf)), pdf, vision);
        DocumentProfileRegistry profiles = new DocumentProfileRegistry(List.of(new DocumentProfiles.GuideProfile(),
                new DocumentProfiles.RegulationProfile(), new DocumentProfiles.JobDescriptionProfile(),
                new DocumentProfiles.StrategyProfile(), new DocumentProfiles.KpiTableProfile(),
                new DocumentProfiles.GenericProfile(), new DocumentProfiles.EvidenceProfile()));
        store = new InMemoryEmbeddingStore<>();
        pipeline = new DocumentIngestionPipeline(docs, reader, profiles,
                List.of(new ImageUploadEnricher(mock(RagAssetRepository.class), mock(RagImageStore.class)),
                        new GuideRouteEnricher(new GuideScreenIndex())),
                new EmbeddingIndexer(FAKE_EMBEDDING, store));
    }

    private static byte[] docxWith(String heading, String body) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFParagraph h = doc.createParagraph();
            h.setStyle("Heading1");
            h.createRun().setText(heading);
            doc.createParagraph().createRun().setText(body);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static byte[] pdfWith(String... lines) throws Exception {
        try (PDDocument doc = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 11);
                cs.setLeading(14);
                cs.newLineAtOffset(50, 700);
                for (String l : lines) {
                    cs.showText(l);
                    cs.newLine();
                }
                cs.endText();
            }
            doc.save(out);
            return out.toByteArray();
        }
    }

    private List<EmbeddingMatch<TextSegment>> all() {
        return store.search(EmbeddingSearchRequest.builder()
                .queryEmbedding(Embedding.from(new float[]{1f, 0f, 0f})).maxResults(100).build()).matches();
    }

    @Test
    @DisplayName("Word: mục dài → nhiều đoạn, mỗi đoạn mở đầu bằng [mục], metadata của mục + tổ chức + loại còn nguyên")
    void docxIngestsThroughTheStandardIngestor() throws Exception {
        String body = "Nộp báo cáo KPI theo các bước sau. ".repeat(120); // ~4.200 ký tự > đoạn 1.200
        UUID orgId = UUID.randomUUID();
        RagDocument saved = pipeline.ingest(FileRef.of("qc.docx", docxWith("3.2. Nộp báo cáo", body)),
                DocumentKind.REGULATION, "Quy chế", orgId, UUID.randomUUID());

        assertThat(saved.getStatus()).isEqualTo(RagDocument.Status.READY);
        assertThat(saved.getChunkCount()).isGreaterThanOrEqualTo(3);
        List<EmbeddingMatch<TextSegment>> found = all();
        assertThat(found).hasSize(saved.getChunkCount());
        for (EmbeddingMatch<TextSegment> m : found) {
            TextSegment seg = m.embedded();
            assertThat(seg.text()).startsWith("[").contains("Nộp báo cáo]");
            assertThat(seg.metadata().getString("docId")).isEqualTo(saved.getId().toString());
            assertThat(seg.metadata().getString("orgId")).isEqualTo(orgId.toString());
            assertThat(seg.metadata().getString("source")).isEqualTo("REGULATION");
            assertThat(seg.metadata().getString("title")).isEqualTo("3.2. Nộp báo cáo");
        }
    }

    @Test
    @DisplayName("PDF (trước chỉ nhận .docx) nạp được vào kho tri thức")
    void pdfIsIngested() throws Exception {
        byte[] pdf = pdfWith(
                "Dieu 1. Pham vi ap dung cho toan bo nhan vien khoi van phong cua cong ty trong nam.",
                "Dieu 2. Danh gia ket qua cong viec dua tren muc do hoan thanh muc tieu va chat luong.");
        RagDocument saved = pipeline.ingest(FileRef.of("quy-che.pdf", pdf), DocumentKind.REGULATION, "Quy chế PDF",
                UUID.randomUUID(), UUID.randomUUID());

        assertThat(saved.getStatus()).isEqualTo(RagDocument.Status.READY);
        assertThat(all()).isNotEmpty();
    }

    @Test
    @DisplayName("minh chứng bài nộp KHÔNG bao giờ vào kho tri thức")
    void evidenceIsNeverIndexed() {
        assertThatThrownBy(() -> pipeline.ingest(FileRef.of("bao-cao.docx", new byte[0]), DocumentKind.EVIDENCE,
                "x", UUID.randomUUID(), UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
        assertThat(all()).isEmpty();
    }

    @Test
    @DisplayName("tệp không đọc được → FAILED kèm lý do cho người quản trị, không ném ra ngoài")
    void unreadableFileFailsWithReason() {
        RagDocument saved = pipeline.ingest(FileRef.of("video.mp4", new byte[]{1, 2}), DocumentKind.REGULATION,
                "x", UUID.randomUUID(), UUID.randomUUID());

        assertThat(saved.getStatus()).isEqualTo(RagDocument.Status.FAILED);
        assertThat(saved.getErrorMessage()).contains(".mp4 chưa hỗ trợ");
    }

    @Test
    @DisplayName("withHeading: [cha › mục] chèn đầu đoạn, metadata giữ nguyên")
    void headingPrefix() {
        TextSegment seg = TextSegment.from("nội dung", Metadata.from(Map.of("parent", "3. KPI", "title", "3.2. Nộp")));
        TextSegment out = EmbeddingIndexer.withHeading(seg);
        assertThat(out.text()).isEqualTo("[3. KPI › 3.2. Nộp]\nnội dung");
        assertThat(out.metadata()).isEqualTo(seg.metadata());
    }
}
