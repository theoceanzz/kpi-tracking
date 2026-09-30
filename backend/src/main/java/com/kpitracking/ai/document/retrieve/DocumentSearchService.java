package com.kpitracking.ai.document.retrieve;

import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.invocation.InvocationContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Metadata;
import dev.langchain4j.rag.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tìm trong kho tri thức bằng một bộ truy hồi, ĐÚNG như khi trợ lý hỏi thật: dựng {@link Metadata} có câu hỏi
 * (langchain4j đòi {@code chatMessage}) và tổ chức của người hỏi trong {@code InvocationParameters}. Phần này
 * trước chép ở ba chỗ (thử tìm của quản trị, tool tài liệu tổ chức, trích quy chế khi chấm).
 */
@Component
public class DocumentSearchService {

    /**
     * @param organizationId tổ chức của người hỏi; {@code null} = không biết (hồ sơ HELP chỉ thấy tài liệu chung)
     */
    public List<RagSearchHitResponse> search(ContentRetriever retriever, String query, UUID organizationId) {
        return search(retriever, query, organizationId, null);
    }

    /**
     * @param onlyDocIds tài liệu kho DUY NHẤT được đọc lần này ({@code null} = không giới hạn, rỗng = không đọc gì)
     *                   — xem {@link DocumentRetrieverFactory#ONLY_DOCS_PARAM}
     */
    public List<RagSearchHitResponse> search(ContentRetriever retriever, String query, UUID organizationId,
                                             List<String> onlyDocIds) {
        if (query == null || query.isBlank()) return List.of();
        if (onlyDocIds != null && onlyDocIds.isEmpty()) return List.of();   // không tài liệu nào được đọc
        String q = query.strip();
        Map<String, Object> values = new java.util.HashMap<>();
        if (organizationId != null) values.put(DocumentRetrieverFactory.ORG_PARAM, organizationId.toString());
        if (onlyDocIds != null) values.put(DocumentRetrieverFactory.ONLY_DOCS_PARAM, List.copyOf(onlyDocIds));
        InvocationParameters params = values.isEmpty() ? new InvocationParameters() : InvocationParameters.from(values);
        Metadata metadata = Metadata.builder()
                .chatMessage(UserMessage.from(q))
                .invocationContext(InvocationContext.builder().invocationParameters(params).build())
                .build();
        return retriever.retrieve(Query.from(q, metadata)).stream().map(RagSearchHitResponse::of).toList();
    }
}
