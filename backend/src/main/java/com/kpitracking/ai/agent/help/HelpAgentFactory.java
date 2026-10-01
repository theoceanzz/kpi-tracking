package com.kpitracking.ai.agent.help;

import com.kpitracking.ai.document.retrieve.DocumentRetrieverFactory;
import com.kpitracking.ai.document.retrieve.RetrievalProfile;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.DefaultRetrievalAugmentor;
import dev.langchain4j.rag.RetrievalAugmentor;
import dev.langchain4j.rag.content.injector.DefaultContentInjector;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.service.AiServices;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.UUID;

/**
 * Dựng {@link HelpAgent} và đường truy hồi của nó.
 *
 * <p>Đường truy hồi: câu hỏi → embedding (tiền tố "query:") → pgvector HYBRID (vector + full-text,
 * gộp RRF) lọc theo QUYỀN của người hỏi (bộ lọc fail-closed ở {@link DocumentRetrieverFactory}) → chèn vào prompt kèm metadata
 * (tài liệu, phạm vi, mục, đường dẫn, ảnh).
 *
 * <p>Chưa có {@code CompressingQueryTransformer}: nó cần bộ nhớ hội thoại để gộp câu hỏi nối tiếp,
 * mà agent này sẽ nhận bộ nhớ khi được nối vào workflow chung ở Pha 1. Thêm lúc đó, ở đúng một
 * dòng.
 */
@Configuration
public class HelpAgentFactory {

    /** Khoá trong {@code InvocationParameters} mang tổ chức của người hỏi. */
    public static final String PARAM_ORG_ID = DocumentRetrieverFactory.ORG_PARAM;
    /** Khoá mang người hỏi — thiếu thì chỉ đọc được bộ hướng dẫn chung (bộ lọc quyền ở DocumentRetrieverFactory). */
    public static final String PARAM_USER_ID = DocumentRetrieverFactory.USER_PARAM;

    /** Tham số cho một lượt hỏi của {@code userId} trong tổ chức {@code orgId}. */
    public static dev.langchain4j.invocation.InvocationParameters params(UUID orgId, UUID userId) {
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        if (orgId != null) m.put(PARAM_ORG_ID, orgId.toString());
        if (userId != null) m.put(PARAM_USER_ID, userId.toString());
        return dev.langchain4j.invocation.InvocationParameters.from(m);
    }

    @Value("${app.ai.rag.retrieval.max-results:6}") private int maxResults;
    @Value("${app.ai.rag.retrieval.min-score:0}") private double minScore;

    /**
     * Bộ truy hồi — bean riêng để màn quản trị "thử tìm trong kho" dùng ĐÚNG nó: cùng chế độ hybrid,
     * cùng số kết quả, cùng bộ lọc tổ chức. Cái người quản trị thấy là cái trợ lý nhận.
     */
    @Bean
    public ContentRetriever helpContentRetriever(DocumentRetrieverFactory retrievers) {
        // Hồ sơ HELP: tài liệu chung + những tài liệu của tổ chức mà CHÍNH người hỏi được xem (cá nhân của mình,
        // đơn vị mình, công ty); không biết người hỏi thì chỉ tài liệu chung.
        return retrievers.retriever(RetrievalProfile.HELP, maxResults, minScore);
    }

    @Bean
    public RetrievalAugmentor helpRetrievalAugmentor(ContentRetriever helpContentRetriever) {
        return DefaultRetrievalAugmentor.builder()
                .contentRetriever(helpContentRetriever)
                .contentInjector(DefaultContentInjector.builder()
                        // Model cần ba thứ ngoài chữ: mục nào (để nói đúng ngữ cảnh), mở ở đâu, ảnh nào.
                        // docTitle + scope: để model ghi nguồn và phân biệt quy định công ty với ghi chú cá nhân.
                        .metadataKeysToInclude(List.of("docTitle", "scope", "parent", "title", "route", "roles", "images", "captions"))
                        .promptTemplate(PromptTemplate.from(
                                "{{userMessage}}\n\nTài liệu liên quan:\n{{contents}}"))
                        .build())
                .build();
    }

    @Bean
    public HelpAgent helpAgent(ChatModel chatModel, RetrievalAugmentor helpRetrievalAugmentor) {
        return AiServices.builder(HelpAgent.class)
                .chatModel(chatModel)
                .retrievalAugmentor(helpRetrievalAugmentor)
                .build();
    }
}
