package com.kpitracking.tool;

import com.kpitracking.dto.response.ai.DocumentSourceResponse;
import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.document.DocumentAccessResolver;
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
 * Lọc bắt buộc theo QUYỀN của người hỏi ({@link DocumentAccessResolver}, cùng bộ lọc fail-closed với trợ lý
 * hỏi đáp — docs/DOCUMENTS_DESIGN.md §6.3) và chỉ hai danh mục — quy chế nói về cách chấm, không nói về việc
 * phải làm; bộ hướng dẫn KeyGo thì càng không. Nhờ lọc theo quyền, mô tả công việc của phòng mà người hỏi
 * không thuộc về không lọt vào gợi ý KPI.
 */
@Component
public class OrgDocumentSearchTool {

    private static final List<DocumentCategory> CATEGORIES = List.of(
            DocumentCategory.JOB_DESCRIPTION, DocumentCategory.STRATEGY);
    private static final String PARAM_ORG = "organizationId";
    private static final String PARAM_USER = "userId";
    private static final int MAX_TEXT = 700;

    private final ToolSupport support;
    private final ContentRetriever retriever;

    public OrgDocumentSearchTool(ToolSupport support, EmbeddingStore<TextSegment> store, EmbeddingModel embeddingModel,
                                 DocumentAccessResolver accessResolver,
                                 @Value("${app.ai.rag.org-documents.max-results:4}") int maxResults) {
        this.support = support;
        this.retriever = EmbeddingStoreContentRetriever.builder()
                .embeddingStore(store)
                .embeddingModel(embeddingModel)
                .embeddingInputType(EmbeddingInputType.QUERY)
                .maxResults(maxResults)
                .minScore(0.0) // hybrid trả điểm RRF, không phải cosine
                .dynamicFilter(query -> {
                    var p = query.metadata() == null ? null : query.metadata().invocationParameters();
                    // Không biết tổ chức/người hỏi thì resolver trả quyền rỗng → bộ lọc không khớp đoạn nào.
                    UUID org = p == null ? null : asUuid(p.get(PARAM_ORG));
                    UUID user = p == null ? null : asUuid(p.get(PARAM_USER));
                    return accessResolver.resolve(user, org).toVectorFilter(CATEGORIES);
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
            Object userId = context == null ? null : context.get(PARAM_USER);
            Map<String, Object> p = new java.util.HashMap<>();
            p.put(PARAM_ORG, orgId);
            if (userId != null) p.put(PARAM_USER, userId);
            InvocationParameters params = InvocationParameters.from(p);
            Metadata metadata = Metadata.builder()
                    .chatMessage(UserMessage.from(q.strip()))
                    .invocationContext(InvocationContext.builder().invocationParameters(params).build())
                    .build();
            List<dev.langchain4j.rag.content.Content> found = retriever.retrieve(Query.from(q.strip(), metadata));
            // Chip nguồn: tài liệu mà công cụ vừa đọc cho lượt này (đã qua bộ lọc quyền ở trên).
            AgentState state = AgentState.from(context);
            if (state != null) {
                state.addSources(found.stream()
                        .map(c -> c.textSegment() == null ? null : DocumentSourceResponse.fromMetadata(c.textSegment().metadata()))
                        .toList());
            }
            List<Map<String, Object>> hits = found.stream()
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

    private static UUID asUuid(Object v) {
        if (v == null) return null;
        if (v instanceof UUID u) return u;
        try {
            return UUID.fromString(v.toString());
        } catch (IllegalArgumentException e) {
            return null;
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
