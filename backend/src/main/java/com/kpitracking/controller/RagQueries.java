package com.kpitracking.controller;

import com.kpitracking.dto.response.ai.RagSearchHitResponse;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.invocation.InvocationContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Metadata;
import dev.langchain4j.rag.query.Query;

import java.util.List;

/**
 * "Thử tìm" dùng chung cho hai cửa quản trị (tổ chức và nền tảng): dựng truy vấn y như lúc trợ lý
 * hỏi thật rồi chạy đúng bộ truy hồi của nó. Bộ lọc tổ chức đọc từ {@code InvocationParameters}
 * — có {@code orgId} thì thấy tài liệu chung + của tổ chức đó, không có thì chỉ tài liệu chung.
 */
final class RagQueries {

    private RagQueries() {}

    static List<RagSearchHitResponse> search(ContentRetriever retriever, String q, InvocationParameters params) {
        if (q == null || q.isBlank()) return List.of();
        String question = q.strip();
        // Metadata của truy vấn đòi có chatMessage: đưa chính câu hỏi vào, như khi trợ lý gọi thật.
        Metadata metadata = Metadata.builder()
                .chatMessage(UserMessage.from(question))
                .invocationContext(InvocationContext.builder().invocationParameters(params).build())
                .build();
        return retriever.retrieve(Query.from(question, metadata)).stream()
                .map(RagSearchHitResponse::of)
                .toList();
    }
}
