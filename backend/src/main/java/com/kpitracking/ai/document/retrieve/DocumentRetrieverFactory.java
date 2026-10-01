package com.kpitracking.ai.document.retrieve;

import com.kpitracking.ai.document.ingest.RagMetadata;
import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolver;
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

import java.util.UUID;

/**
 * Dựng bộ truy hồi kho tri thức theo {@link RetrievalProfile} (Factory). Trước đây ba nơi (hỏi đáp, gợi ý KPI,
 * chấm bài nộp) mỗi nơi tự dựng một {@code EmbeddingStoreContentRetriever} với bộ lọc tổ chức chép tay — nay
 * CHỐT CHẶN của MỌI lần đọc kho nằm ở đúng {@link #filterFor}.
 *
 * <p>Bộ lọc là FAIL-CLOSED theo phạm vi tài liệu (docs/DOCUMENTS_DESIGN.md §6.2): chỉ những nhánh khớp DƯƠNG theo
 * {@code scope} mới lọt, vector thiếu {@code scope} không ai đọc được.
 * <ul>
 *   <li><b>Biết người hỏi</b> ({@link #USER_PARAM}): đọc đúng những gì người đó được xem —
 *       {@link DocumentAccess#toVectorFilter} (tài liệu cá nhân CỦA MÌNH, đơn vị mình được xem, công ty).</li>
 *   <li><b>Không có người hỏi</b> (việc chạy theo hệ thống, vd AI chấm bài): CHỈ tài liệu {@code COMPANY} của tổ
 *       chức — không bao giờ đọc tài liệu cá nhân hay tài liệu đơn vị.</li>
 *   <li><b>Không biết tổ chức</b>: chỉ tài liệu chung (hồ sơ có {@code includeGlobal}) hoặc KHÔNG thấy gì.</li>
 * </ul>
 * Sau đó mới tới lọc loại tài liệu của hồ sơ và danh sách cho phép {@link #ONLY_DOCS_PARAM}.
 */
@Component
@RequiredArgsConstructor
public class DocumentRetrieverFactory {

    /** Khoá trong {@code InvocationParameters} mang tổ chức của người hỏi. */
    public static final String ORG_PARAM = "orgId";
    /** Khoá mang người hỏi. Có thì đọc theo QUYỀN của người đó; không có thì chỉ tài liệu công ty. */
    public static final String USER_PARAM = "userId";
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
    private final DocumentAccessResolver accessResolver;

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
                .dynamicFilter(query -> filterFor(profile, param(query, ORG_PARAM), param(query, USER_PARAM),
                        onlyOf(query)))
                .build();
    }

    static Object param(Query query, String key) {
        return query.metadata() == null || query.metadata().invocationParameters() == null
                ? null : query.metadata().invocationParameters().get(key);
    }

    /** Danh sách cho phép của lần đọc này, hoặc {@code null} khi không giới hạn theo tài liệu. */
    static java.util.Collection<?> onlyOf(Query query) {
        Object v = param(query, ONLY_DOCS_PARAM);
        return v instanceof java.util.Collection<?> c ? c : null;
    }

    /**
     * Bộ lọc của một lần đọc kho — MỌI lần đọc đi qua đây. Biết người hỏi thì theo quyền của người đó, không thì
     * như {@link #filterFor(RetrievalProfile, Object, java.util.Collection)}.
     */
    Filter filterFor(RetrievalProfile profile, Object org, Object user, java.util.Collection<?> onlyDocIds) {
        UUID orgId = uuid(org);
        UUID userId = uuid(user);
        if (orgId == null || userId == null) return filterFor(profile, org, onlyDocIds);
        DocumentAccess access = accessResolver.resolve(userId, orgId);
        return restrict(profile, access.toVectorFilter(profile.includeGlobal()), access.member(), onlyDocIds);
    }

    /**
     * Không có người hỏi: tài liệu CÔNG TY của tổ chức (+ tài liệu chung nếu hồ sơ cho phép), rồi CHỈ giữ các tài
     * liệu {@code onlyDocIds}. {@code null} = không giới hạn; rỗng = không đọc gì.
     */
    static Filter filterFor(RetrievalProfile profile, Object org, java.util.Collection<?> onlyDocIds) {
        return restrict(profile, companyScope(profile, org), org != null, onlyDocIds);
    }

    /** Không có người hỏi, không giới hạn theo tài liệu. */
    static Filter filterFor(RetrievalProfile profile, Object org) {
        return filterFor(profile, org, null);
    }

    /** Phần phạm vi khi không có người hỏi: CHỈ {@code COMPANY} của tổ chức, cộng tài liệu chung nếu hồ sơ cho phép. */
    private static Filter companyScope(RetrievalProfile profile, Object org) {
        Filter global = key(RagMetadata.ORG_ID).isEqualTo(RagMetadata.GLOBAL_ORG)
                .and(key(RagMetadata.SCOPE).isEqualTo(RagMetadata.SCOPE_GLOBAL));
        if (org == null) {
            return profile.includeGlobal() ? global : nothing();
        }
        Filter company = key(RagMetadata.ORG_ID).isEqualTo(org.toString())
                .and(key(RagMetadata.SCOPE).isEqualTo(RagMetadata.SCOPE_COMPANY));
        return profile.includeGlobal() ? global.or(company) : company;
    }

    /** Lọc loại tài liệu của hồ sơ (chỉ khi đọc được tài liệu tổ chức), rồi danh sách cho phép. */
    private static Filter restrict(RetrievalProfile profile, Filter base, boolean orgKnown,
                                   java.util.Collection<?> onlyDocIds) {
        Filter f = orgKnown ? bySources(profile, base) : base;
        if (onlyDocIds == null) return f;
        if (onlyDocIds.isEmpty()) return f.and(key(RagMetadata.DOC_ID).isEqualTo(NOBODY));
        return f.and(key(RagMetadata.DOC_ID).isIn(onlyDocIds.stream().map(Object::toString).toList()));
    }

    private static Filter bySources(RetrievalProfile profile, Filter base) {
        if (profile.sources() == null || base.equals(nothing())) return base;
        return base.and(key(RagMetadata.SOURCE).isIn(profile.sources().stream().map(Enum::name).toList()));
    }

    private static MetadataFilterBuilder key(String k) {
        return MetadataFilterBuilder.metadataKey(k);
    }

    /** Không khớp đoạn nào: không tổ chức nào mang id này. */
    static Filter nothing() {
        return key(RagMetadata.ORG_ID).isEqualTo(NOBODY);
    }

    private static UUID uuid(Object v) {
        if (v == null) return null;
        if (v instanceof UUID u) return u;
        try {
            return UUID.fromString(v.toString());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
