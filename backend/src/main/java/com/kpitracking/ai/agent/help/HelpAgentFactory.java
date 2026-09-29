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

/**
 * Dựng {@link HelpAgent} và đường truy hồi của nó.
 *
 * <p>Đường truy hồi: câu hỏi → embedding (tiền tố "query:") → pgvector HYBRID (vector + full-text,
 * gộp RRF) lọc theo tổ chức → chèn vào prompt kèm metadata (tiêu đề, đường dẫn, ảnh).
 *
 * <p>Chưa có {@code CompressingQueryTransformer}: nó cần bộ nhớ hội thoại để gộp câu hỏi nối tiếp,
 * mà agent này sẽ nhận bộ nhớ khi được nối vào workflow chung ở Pha 1. Thêm lúc đó, ở đúng một
 * dòng.
 */
@Configuration
public class HelpAgentFactory {

    /** Khoá trong {@code InvocationParameters} mang tổ chức của người hỏi. */
    public static final String PARAM_ORG_ID = DocumentRetrieverFactory.ORG_PARAM;

    @Value("${app.ai.rag.retrieval.max-results:6}") private int maxResults;
    @Value("${app.ai.rag.retrieval.min-score:0}") private double minScore;

    /**
     * Bộ truy hồi — bean riêng để màn quản trị "thử tìm trong kho" dùng ĐÚNG nó: cùng chế độ hybrid,
     * cùng số kết quả, cùng bộ lọc tổ chức. Cái người quản trị thấy là cái trợ lý nhận.
     */
    @Bean
    public ContentRetriever helpContentRetriever(DocumentRetrieverFactory retrievers) {
        // Hồ sơ HELP: tài liệu chung + của tổ chức người hỏi; không có tổ chức thì chỉ tài liệu chung.
        return retrievers.retriever(RetrievalProfile.HELP, maxResults, minScore);
    }

    @Bean
    public RetrievalAugmentor helpRetrievalAugmentor(ContentRetriever helpContentRetriever) {
        return DefaultRetrievalAugmentor.builder()
                .contentRetriever(helpContentRetriever)
                .contentInjector(DefaultContentInjector.builder()
                        // Model cần ba thứ ngoài chữ: mục nào (để nói đúng ngữ cảnh), mở ở đâu, ảnh nào.
                        .metadataKeysToInclude(List.of("parent", "title", "route", "roles", "images", "captions"))
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
