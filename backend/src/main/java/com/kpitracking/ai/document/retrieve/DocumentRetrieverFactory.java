package com.kpitracking.ai.document.retrieve;

import com.kpitracking.ai.document.ingest.RagMetadata;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Dựng bộ truy hồi kho tri thức theo {@link RetrievalProfile} (Factory). Trước đây ba nơi (hỏi đáp, gợi ý KPI,
 * chấm bài nộp) mỗi nơi tự dựng một {@code EmbeddingStoreContentRetriever} với bộ lọc tổ chức chép tay — nay
 * CHỐT CHẶN ĐA TỔ CHỨC nằm ở đúng {@link #filterFor}.
 *
 * <p>Tổ chức của người hỏi đi qua {@code InvocationParameters} khoá {@link #ORG_PARAM}. Không biết tổ chức thì
 * chỉ thấy tài liệu chung (hồ sơ có {@code includeGlobal}) hoặc KHÔNG thấy gì — an toàn hơn thấy tất cả.
 */
@Component
@RequiredArgsConstructor
public class DocumentRetrieverFactory {

    /** Khoá trong {@code InvocationParameters} mang tổ chức của người hỏi. */
    public static final String ORG_PARAM = "orgId";
    /**
     * Khoá tuỳ chọn: danh sách id tài liệu DUY NHẤT được đọc lần này (danh sách rỗng = không đọc gì). Dùng khi chấm
     * bài: chỉ quy chế áp cho đơn vị người đó + tài liệu nạp tay dùng chung.
     *
     * <p>Là danh sách CHO PHÉP, không phải danh sách chặn: kho vector có thể còn đoạn "mồ côi" của tài liệu đã xoá
     * (hoặc DB dựng lại mà kho vector giữ nguyên) — chặn theo danh sách thì chúng vẫn lọt. Lỗi 29/09: quy chế IT-OPS
     * cũ hiện trong kết quả của Phòng Truyền thông.
     */
    public static final String ONLY_DOCS_PARAM = "onlyDocIds";
    /** Giá trị không tổ chức nào có — bộ lọc "không đọc gì". */
    static final String NOBODY = "-";

    private final EmbeddingStore<TextSegment> store;
    private final EmbeddingModel embeddingModel;

    /**
     * @param minScore với kho HYBRID điểm là RRF (≤ ~0,033), không phải cosine — thường để 0
     */
    public ContentRetriever retriever(RetrievalProfile profile, int maxResults, double minScore) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(store)
                .embeddingModel(embeddingModel)
                .embeddingInputType(EmbeddingInputType.QUERY)
                .maxResults(maxResults)
                .minScore(minScore)
                .dynamicFilter(query -> filterFor(profile, orgOf(query), onlyOf(query)))
                .build();
    }

    static Object orgOf(Query query) {
        return query.metadata() == null || query.metadata().invocationParameters() == null
                ? null : query.metadata().invocationParameters().get(ORG_PARAM);
    }

    /** Danh sách cho phép của lần đọc này, hoặc {@code null} khi không giới hạn theo tài liệu. */
    static java.util.Collection<?> onlyOf(Query query) {
        if (query.metadata() == null || query.metadata().invocationParameters() == null) return null;
        Object v = query.metadata().invocationParameters().get(ONLY_DOCS_PARAM);
        return v instanceof java.util.Collection<?> c ? c : null;
    }

    /**
     * Như {@link #filterFor(RetrievalProfile, Object)} rồi CHỈ giữ các tài liệu {@code onlyDocIds}.
     * {@code null} = không giới hạn; rỗng = không đọc gì.
     */
    static Filter filterFor(RetrievalProfile profile, Object org, java.util.Collection<?> onlyDocIds) {
        Filter base = filterFor(profile, org);
        if (onlyDocIds == null) return base;
        if (onlyDocIds.isEmpty()) return base.and(MetadataFilterBuilder.metadataKey(RagMetadata.DOC_ID).isEqualTo(NOBODY));
        return base.and(MetadataFilterBuilder.metadataKey(RagMetadata.DOC_ID)
                .isIn(onlyDocIds.stream().map(Object::toString).toList()));
    }

    /** Bộ lọc tổ chức + loại tài liệu cho một hồ sơ truy hồi — MỌI lần đọc kho đi qua đây. */
    static Filter filterFor(RetrievalProfile profile, Object org) {
        String orgKey = org == null ? null : org.toString();
        Filter byOrg;
        if (profile.includeGlobal()) {
            byOrg = orgKey == null
                    ? MetadataFilterBuilder.metadataKey(RagMetadata.ORG_ID).isEqualTo(RagMetadata.GLOBAL_ORG)
                    : MetadataFilterBuilder.metadataKey(RagMetadata.ORG_ID).isIn(RagMetadata.GLOBAL_ORG, orgKey);
        } else {
            byOrg = MetadataFilterBuilder.metadataKey(RagMetadata.ORG_ID).isEqualTo(orgKey == null ? NOBODY : orgKey);
        }
        if (profile.sources() == null || orgKey == null) return byOrg;
        return byOrg.and(MetadataFilterBuilder.metadataKey(RagMetadata.SOURCE)
                .isIn(profile.sources().stream().map(Enum::name).toList()));
    }
}
