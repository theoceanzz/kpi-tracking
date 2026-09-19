package com.kpitracking.ai.agent;

import com.kpitracking.entity.RagDocument;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.DefaultRetrievalAugmentor;
import dev.langchain4j.rag.RetrievalAugmentor;
import dev.langchain4j.rag.content.injector.DefaultContentInjector;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.rag.query.transformer.QueryTransformer;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * RAG cho gợi ý KPI: mô tả công việc và chiến lược của TỔ CHỨC nuôi {@code KpiSuggestionAgent}.
 *
 * <p>Không có tài liệu, gợi ý KPI chỉ bám số liệu thống kê (điểm yếu/cơ hội) — ra những chỉ tiêu
 * chung chung đúng với mọi công ty. Có mô tả công việc của đơn vị và mục tiêu năm, gợi ý bám vào
 * việc thật của đơn vị và hướng công ty đang đi. Ba điểm khác nhánh HELP:
 * <ul>
 *   <li><b>Truy vấn không phải là prompt.</b> Prompt gợi ý là một đoạn chỉ dẫn dài; thứ cần tìm là
 *       "chức năng nhiệm vụ của đơn vị X" — {@link QueryTransformer} dựng câu tìm từ tên đơn vị và
 *       bối cảnh người dùng gõ, lấy qua {@code InvocationParameters}.</li>
 *   <li><b>Chỉ đọc hai loại tài liệu</b> ({@code JOB_DESCRIPTION}, {@code STRATEGY}) của đúng tổ chức.
 *       Quy chế nói về cách chấm, không nói về việc phải làm; bộ hướng dẫn KeyGo thì càng không.</li>
 *   <li><b>Không có tài liệu thì prompt giữ nguyên</b> — bộ chèn không thêm gì khi danh sách rỗng,
 *       nên tổ chức chưa tải tài liệu không bị đổi hành vi.</li>
 * </ul>
 */
@Configuration
public class KpiSuggestionRag {

    /** Khoá trong {@code InvocationParameters}: tên đơn vị đang được gợi ý. */
    public static final String PARAM_UNIT_NAME = "unitName";
    /** Khoá trong {@code InvocationParameters}: bối cảnh người dùng gõ khi soạn chỉ tiêu (có thể rỗng). */
    public static final String PARAM_CONTEXT = "suggestionContext";

    private static final List<String> SOURCES = List.of(
            RagDocument.Source.JOB_DESCRIPTION.name(), RagDocument.Source.STRATEGY.name());

    @Value("${app.ai.rag.kpi-suggestion.max-results:4}") private int maxResults;

    @Bean
    public RetrievalAugmentor kpiSuggestionAugmentor(EmbeddingStore<TextSegment> store, EmbeddingModel embeddingModel) {
        var retriever = EmbeddingStoreContentRetriever.builder()
                .embeddingStore(store)
                .embeddingModel(embeddingModel)
                .embeddingInputType(EmbeddingInputType.QUERY)
                .maxResults(maxResults)
                .minScore(0.0) // hybrid trả điểm RRF, không phải cosine
                .dynamicFilter(query -> {
                    Object org = params(query).get("organizationId");
                    // Không biết tổ chức thì không đọc gì — an toàn hơn đọc tất cả.
                    if (org == null) return MetadataFilterBuilder.metadataKey("orgId").isEqualTo("-");
                    return MetadataFilterBuilder.metadataKey("orgId").isEqualTo(org.toString())
                            .and(MetadataFilterBuilder.metadataKey("source").isIn(SOURCES));
                })
                .build();

        QueryTransformer unitQuery = query -> {
            InvocationParameters p = params(query);
            String unit = p.get(PARAM_UNIT_NAME);
            String context = p.get(PARAM_CONTEXT);
            StringBuilder text = new StringBuilder("Chức năng, nhiệm vụ, mục tiêu và chỉ tiêu của ")
                    .append(unit == null || unit.isBlank() ? "đơn vị" : unit);
            if (context != null && !context.isBlank()) text.append(": ").append(context.strip());
            return List.of(Query.from(text.toString(), query.metadata()));
        };

        return DefaultRetrievalAugmentor.builder()
                .queryTransformer(unitQuery)
                .contentRetriever(retriever)
                .contentInjector(DefaultContentInjector.builder()
                        .metadataKeysToInclude(List.of("docTitle", "parent", "title"))
                        .promptTemplate(PromptTemplate.from(
                                "{{userMessage}}\n\nTài liệu của tổ chức liên quan tới đơn vị này (mô tả công việc,"
                                        + " chiến lược) — gợi ý phải bám vào nhiệm vụ và mục tiêu nêu trong đó:\n{{contents}}"))
                        .build())
                .build();
    }

    private static InvocationParameters params(Query query) {
        return query.metadata() == null || query.metadata().invocationParameters() == null
                ? new InvocationParameters() : query.metadata().invocationParameters();
    }
}
