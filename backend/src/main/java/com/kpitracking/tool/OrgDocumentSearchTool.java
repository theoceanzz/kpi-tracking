package com.kpitracking.tool;

import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import com.kpitracking.entity.RagDocument;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.OrgDocumentSearchRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.invocation.InvocationContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.rag.query.Metadata;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tra MÔ TẢ CÔNG VIỆC và CHIẾN LƯỢC của tổ chức trong kho tri thức — để agent chính gợi ý chỉ tiêu
 * bám vào nhiệm vụ thật của đơn vị thay vì một bộ KPI chung chung.
 *
 * <p>Thay cho agent gợi ý KPI riêng (bỏ 22/09/2026): trước đây tài liệu này chỉ đi vào prompt của
 * {@code KpiSuggestionAgent} qua {@code RetrievalAugmentor}; nay gợi ý KPI đi qua đường điền form
 * của agent chính ({@code suggest_kpi_form}), nên tài liệu phải là một TOOL để agent chính tự tra.
 * Lọc bắt buộc theo {@code organizationId} của lượt và chỉ hai loại tài liệu — quy chế nói về cách
 * chấm, không nói về việc phải làm; bộ hướng dẫn KeyGo thì càng không.
 */
@Component
public class OrgDocumentSearchTool {

    private static final List<String> SOURCES = List.of(
            RagDocument.Source.JOB_DESCRIPTION.name(), RagDocument.Source.STRATEGY.name());
    private static final int MAX_TEXT = 700;

    private final ToolSupport support;
    private final ContentRetriever retriever;

    public OrgDocumentSearchTool(ToolSupport support, EmbeddingStore<TextSegment> store, EmbeddingModel embeddingModel,
                                 @Value("${app.ai.rag.org-documents.max-results:4}") int maxResults) {
        this.support = support;
        this.retriever = EmbeddingStoreContentRetriever.builder()
                .embeddingStore(store)
                .embeddingModel(embeddingModel)
                .embeddingInputType(EmbeddingInputType.QUERY)
                .maxResults(maxResults)
                .minScore(0.0) // hybrid trả điểm RRF, không phải cosine
                .dynamicFilter(query -> {
                    Object org = query.metadata() == null || query.metadata().invocationParameters() == null
                            ? null : query.metadata().invocationParameters().get("organizationId");
                    // Không biết tổ chức thì không đọc gì — an toàn hơn đọc tất cả.
                    if (org == null) return MetadataFilterBuilder.metadataKey("orgId").isEqualTo("-");
                    return MetadataFilterBuilder.metadataKey("orgId").isEqualTo(org.toString())
                            .and(MetadataFilterBuilder.metadataKey("source").isIn(SOURCES));
                })
                .build();
    }

    @Tool(name = "get_org_documents", value =
            "Tra MÔ TẢ CÔNG VIỆC và CHIẾN LƯỢC mà tổ chức đã tải lên: chức năng, nhiệm vụ, mục tiêu năm, "
            + "chỉ số cam kết của một đơn vị. Dùng TRƯỚC khi gợi ý / đề xuất chỉ tiêu KPI mới cho một đơn vị "
            + "(query = 'nhiệm vụ và mục tiêu của <tên đơn vị>'), để chỉ tiêu bám vào việc thật và con số thật "
            + "trong tài liệu. Trả rỗng khi tổ chức chưa tải tài liệu — khi đó dựa vào số liệu KPI hiện có. "
            + "KHÔNG dùng để hỏi cách dùng KeyGo hay quy chế chấm điểm.")
    public String searchOrgDocuments(OrgDocumentSearchRequest request, InvocationParameters context) {
        try {
            String q = request == null ? null : request.query();
            if (!ToolSupport.notBlank(q)) {
                throw new IllegalArgumentException("Cần query — vd 'nhiệm vụ và mục tiêu của Phòng IT'.");
            }
            UUID orgId = support.getOrgId(context);
            InvocationParameters params = InvocationParameters.from(Map.of("organizationId", orgId));
            Metadata metadata = Metadata.builder()
                    .chatMessage(UserMessage.from(q.strip()))
                    .invocationContext(InvocationContext.builder().invocationParameters(params).build())
                    .build();
            List<Map<String, Object>> hits = retriever.retrieve(Query.from(q.strip(), metadata)).stream()
                    .map(RagSearchHitResponse::of)
                    .map(OrgDocumentSearchTool::compact)
                    .toList();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("count", hits.size());
            out.put("hits", hits);
            if (hits.isEmpty()) {
                out.put("message", "Tổ chức chưa tải mô tả công việc / chiến lược liên quan. Gợi ý dựa vào số liệu KPI hiện có.");
            }
            return support.respond(context, "get_org_documents", out);
        } catch (Exception e) {
            return support.toolError("get_org_documents", e);
        }
    }

    private static Map<String, Object> compact(RagSearchHitResponse h) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("document", h.docTitle());
        m.put("section", h.parent() != null && !h.parent().isBlank() ? h.parent() + " › " + h.title() : h.title());
        String text = h.text() == null ? "" : h.text().strip();
        m.put("text", text.length() > MAX_TEXT ? text.substring(0, MAX_TEXT) + "…" : text);
        return m;
    }
}
