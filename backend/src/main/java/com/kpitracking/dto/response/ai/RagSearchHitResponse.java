package com.kpitracking.dto.response.ai;

import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.ContentMetadata;

import java.util.List;

/**
 * Một kết quả của phép "thử tìm trong kho" — chính là {@code Content} bộ truy hồi trả cho trợ lý.
 *
 * <p>{@code score} là điểm gộp RRF của chế độ hybrid (vector + full-text), thường ≤ 0,033 và chỉ có
 * nghĩa để XẾP HẠNG trong cùng một lần tìm — không phải cosine, không so được giữa hai câu hỏi.
 */
public record RagSearchHitResponse(
        Double score,
        String docId,
        String docTitle,
        String title,
        String parent,
        String route,
        String text,
        List<String> images) {

    public static RagSearchHitResponse of(Content content) {
        var m = content.textSegment().metadata();
        Object score = content.metadata() == null ? null : content.metadata().get(ContentMetadata.SCORE);
        return new RagSearchHitResponse(
                score instanceof Number n ? n.doubleValue() : null,
                m.getString("docId"), m.getString("docTitle"), m.getString("title"), m.getString("parent"),
                m.getString("route"), content.textSegment().text(), RagChunkResponse.split(m.getString("images")));
    }
}
