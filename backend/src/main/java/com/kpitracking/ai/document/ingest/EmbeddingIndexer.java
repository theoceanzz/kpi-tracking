package com.kpitracking.ai.document.ingest;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingStoreIngestor;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bước cuối của đường nạp: cắt đoạn → gắn tiêu đề → embedding → pgvector (HYBRID), qua
 * {@code EmbeddingStoreIngestor} chuẩn của langchain4j. Phần "của KeyGo" chỉ là {@link #withHeading}.
 *
 * <p><b>Nạp lại là thay thế</b>: xoá mọi vector của {@code docId} trước khi thêm — nếu không, sửa tài liệu rồi
 * nạp lại sẽ để bản cũ và bản mới cùng trả lời.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EmbeddingIndexer {

    /**
     * Cắt theo KÝ TỰ: e5-small nhận tối đa 512 token, tiếng Việt qua tokenizer XLM-R ≈ 3 ký tự/token nên 1200
     * ký tự ≈ 400 token — còn chỗ cho tiêu đề chèn đầu đoạn. Chồng 150 để câu bị cắt đôi vẫn nguyên ở một bên.
     */
    static final int MAX_CHARS = 1200;
    static final int OVERLAP_CHARS = 150;

    private final EmbeddingModel embeddingModel;
    private final EmbeddingStore<TextSegment> embeddingStore;

    /** @return số đoạn đã nạp */
    public int replace(UUID docId, List<Document> docs) {
        remove(docId);
        AtomicInteger count = new AtomicInteger();
        EmbeddingStoreIngestor.builder()
                .documentSplitter(DocumentSplitters.recursive(MAX_CHARS, OVERLAP_CHARS))
                .textSegmentTransformer(seg -> {
                    count.incrementAndGet();
                    return withHeading(seg);
                })
                .embeddingModel(embeddingModel)
                .embeddingStore(embeddingStore)
                .build()
                .ingest(docs);
        log.info("Đã nạp {} đoạn cho tài liệu {}", count.get(), docId);
        return count.get();
    }

    public void remove(UUID docId) {
        embeddingStore.removeAll(MetadataFilterBuilder.metadataKey(RagMetadata.DOC_ID).isEqualTo(docId.toString()));
    }

    /**
     * Tiêu đề chèn vào ĐẦU mỗi đoạn: đoạn thứ ba của "3.11. Quy trình" mà không có chữ "quy trình" nào thì
     * vector của nó không biết mình thuộc mục nào. Bộ tách đoạn đã chép metadata của mục sang từng đoạn.
     */
    static TextSegment withHeading(TextSegment seg) {
        String head = "[" + seg.metadata().getString("parent") + " › " + seg.metadata().getString("title") + "]\n";
        return TextSegment.from(head + seg.text(), seg.metadata());
    }
}
