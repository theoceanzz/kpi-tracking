package com.kpitracking.ai.rag;

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
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Nạp qua {@code EmbeddingStoreIngestor}: tách đoạn, gắn tiêu đề, giữ metadata, đếm đúng số đoạn.
 * Embedding giả (vector hằng) và kho trong bộ nhớ — test nói về phần "của KeyGo" trong đường nạp,
 * không đo chất lượng vector.
 */
class RagIngestionServiceTest {

    /** Vector hằng 3 chiều: đủ để kho nhận và tìm lại, không cần model thật. */
    private static final EmbeddingModel FAKE_EMBEDDING = new EmbeddingModel() {
        @Override
        public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
            return Response.from(segments.stream().map(s -> Embedding.from(new float[]{1f, 0f, 0f})).toList());
        }
    };

    private static ByteArrayInputStream docxWith(String heading, String body) throws Exception {
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFParagraph h = doc.createParagraph();
            h.setStyle("Heading1");
            h.createRun().setText(heading);
            doc.createParagraph().createRun().setText(body);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        }
    }

    @Test
    @DisplayName("mục dài hơn một đoạn -> nhiều đoạn, mỗi đoạn mở đầu bằng [mục], metadata của mục còn nguyên")
    void ingestsThroughTheStandardIngestor() throws Exception {
        RagDocumentRepository docs = mock(RagDocumentRepository.class);
        when(docs.save(any())).thenAnswer(inv -> {
            RagDocument d = inv.getArgument(0);
            if (d.getId() == null) d.setId(UUID.randomUUID());
            return d;
        });
        InMemoryEmbeddingStore<TextSegment> store = new InMemoryEmbeddingStore<>();
        RagIngestionService service = new RagIngestionService(docs, mock(RagAssetRepository.class),
                mock(RagImageStore.class), FAKE_EMBEDDING, store, new GuideScreenIndex());

        String body = "Nộp báo cáo KPI theo các bước sau. ".repeat(120); // ~4.200 ký tự > MAX_CHARS
        UUID orgId = UUID.randomUUID();
        RagDocument saved = service.ingestDocx(docxWith("3.2. Nộp báo cáo", body), "qc.docx",
                "Quy chế", RagDocument.Source.REGULATION, orgId, UUID.randomUUID());

        assertThat(saved.getStatus()).isEqualTo(RagDocument.Status.READY);
        assertThat(saved.getChunkCount()).isGreaterThanOrEqualTo(3);

        List<EmbeddingMatch<TextSegment>> found = store.search(EmbeddingSearchRequest.builder()
                .queryEmbedding(Embedding.from(new float[]{1f, 0f, 0f})).maxResults(100).build()).matches();
        assertThat(found).hasSize(saved.getChunkCount());
        for (EmbeddingMatch<TextSegment> m : found) {
            TextSegment seg = m.embedded();
            assertThat(seg.text()).startsWith("[");
            assertThat(seg.text()).contains("Nộp báo cáo]");
            assertThat(seg.metadata().getString("docId")).isEqualTo(saved.getId().toString());
            assertThat(seg.metadata().getString("orgId")).isEqualTo(orgId.toString());
            assertThat(seg.metadata().getString("title")).isEqualTo("3.2. Nộp báo cáo");
        }
    }

    @Test
    @DisplayName("withHeading: [cha › mục] chèn đầu đoạn, metadata giữ nguyên")
    void headingPrefix() {
        TextSegment seg = TextSegment.from("nội dung", Metadata.from(Map.of("parent", "3. KPI", "title", "3.2. Nộp")));
        TextSegment out = RagIngestionService.withHeading(seg);
        assertThat(out.text()).isEqualTo("[3. KPI › 3.2. Nộp]\nnội dung");
        assertThat(out.metadata()).isEqualTo(seg.metadata());
    }
}
