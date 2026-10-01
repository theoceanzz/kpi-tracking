package com.kpitracking.ai.agent.help;

import com.kpitracking.dto.response.ai.DocumentSourceResponse;
import com.kpitracking.service.ai.agent.AgentState;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.service.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/** Chip nguồn của K.AI: dựng từ metadata các đoạn đã truy hồi (docs/DOCUMENTS_DESIGN.md §8.5). */
class DocumentSourcesTest {

    static Content chunk(Map<String, Object> meta) {
        return Content.from(TextSegment.from("nội dung", Metadata.from(meta)));
    }

    @Test
    @DisplayName("đoạn của thư viện tài liệu → nguồn có tên, phạm vi, mục; không phải tài liệu cũ")
    void fromLibraryChunk() {
        DocumentSourceResponse s = DocumentSourceResponse.fromMetadata(Metadata.from(Map.of(
                "docId", "d1", "scope", "COMPANY", "docTitle", "Quy chế lương", "parent", "3. Thưởng",
                "title", "3.2 Loại A", "version", 2)));
        assertThat(s).isEqualTo(new DocumentSourceResponse("d1", "Quy chế lương", "COMPANY", "3. Thưởng › 3.2 Loại A", false));
    }

    @Test
    @DisplayName("bộ hướng dẫn chung và đoạn thiếu khoá không thành chip; vector cũ không có version → legacy")
    void globalAndBrokenAreSkipped() {
        assertThat(DocumentSourceResponse.fromMetadata(Metadata.from(Map.of("docId", "g", "scope", "GLOBAL")))).isNull();
        assertThat(DocumentSourceResponse.fromMetadata(Metadata.from(Map.of("docId", "x")))).isNull();
        assertThat(DocumentSourceResponse.fromMetadata(Metadata.from(Map.of("scope", "COMPANY")))).isNull();
        DocumentSourceResponse legacy = DocumentSourceResponse.fromMetadata(Metadata.from(Map.of(
                "docId", "old", "scope", "COMPANY", "docTitle", "Quy chế cũ", "title", "1. Chung")));
        assertThat(legacy.legacy()).isTrue();
        assertThat(legacy.section()).isEqualTo("1. Chung");
    }

    @Test
    @DisplayName("HelpService.sourcesOf: mỗi tài liệu một lần, giữ thứ tự gặp, bỏ GLOBAL")
    void sourcesOfDeduplicates() {
        Result<String> r = Result.<String>builder()
                .content("trả lời")
                .sources(List.of(
                        chunk(Map.of("docId", "a", "scope", "UNIT", "docTitle", "A", "title", "1", "version", 1)),
                        chunk(Map.of("docId", "g", "scope", "GLOBAL", "title", "Hướng dẫn")),
                        chunk(Map.of("docId", "a", "scope", "UNIT", "docTitle", "A", "title", "2", "version", 1)),
                        chunk(Map.of("docId", "b", "scope", "PERSONAL", "docTitle", "B", "title", "x", "version", 1))))
                .build();
        assertThat(HelpService.sourcesOf(r)).extracting(DocumentSourceResponse::docId).containsExactly("a", "b");
        assertThat(HelpService.sourcesOf(r).get(0).section()).isEqualTo("1");
    }

    @Test
    @DisplayName("HelpAgent thật (AiServices + RetrievalAugmentor của app, model giả): Result mang các đoạn đã truy hồi")
    void helpAgentResultCarriesRetrievedChunks() {
        dev.langchain4j.model.chat.ChatModel fakeModel = new dev.langchain4j.model.chat.ChatModel() {
            @Override
            public dev.langchain4j.model.chat.response.ChatResponse doChat(dev.langchain4j.model.chat.request.ChatRequest request) {
                return dev.langchain4j.model.chat.response.ChatResponse.builder()
                        .aiMessage(dev.langchain4j.data.message.AiMessage.from("Loại A được thưởng hai tháng lương."))
                        .build();
            }
        };
        dev.langchain4j.rag.content.retriever.ContentRetriever retriever = q -> List.of(
                chunk(Map.of("docId", "qc", "scope", "COMPANY", "docTitle", "Quy chế thưởng", "title", "Loại A", "version", 1)),
                chunk(Map.of("docId", "g", "scope", "GLOBAL", "title", "Hướng dẫn")));
        HelpAgentFactory factory = new HelpAgentFactory();
        HelpAgent agent = factory.helpAgent(fakeModel, factory.helpRetrievalAugmentor(retriever));

        Result<String> r = agent.answer("loại A thưởng gì?", HelpAgentFactory.params(null, null));

        assertThat(r.content()).contains("hai tháng");
        assertThat(HelpService.sourcesOf(r)).singleElement()
                .satisfies(src -> assertThat(src.title()).isEqualTo("Quy chế thưởng"));
    }

    @Test
    @DisplayName("AgentState.addSources: gộp nhiều lần gọi, bỏ trùng, tối đa 6 chip")
    void agentStateCapsAndDeduplicates() {
        AgentState st = AgentState.forToolsOnly();
        st.addSources(List.of(new DocumentSourceResponse("a", "A", "COMPANY", null, false)));
        st.addSources(IntStream.range(0, 10)
                .mapToObj(i -> new DocumentSourceResponse(i == 0 ? "a" : "d" + i, "T", "COMPANY", null, false))
                .toList());
        assertThat(st.getSources()).hasSize(6);
        assertThat(st.getSources()).extracting(DocumentSourceResponse::docId).doesNotHaveDuplicates().startsWith("a");
    }
}
