package com.kpitracking.ai.rag;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInput;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.model.embedding.request.EmbeddingRequest;
import dev.langchain4j.model.embedding.request.EmbeddingRequestParameters;
import dev.langchain4j.model.embedding.response.EmbeddingResponse;
import dev.langchain4j.model.output.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Test cho lớp bọc E5: đúng tiền tố cho đúng đường, và tiền tố KHÔNG lọt vào chữ lưu trong kho.
 *
 * <p>Bỏ tiền tố là lỗi âm thầm — không ngoại lệ, chỉ có kết quả tìm kiếm kém đi. Test là chỗ duy
 * nhất nó hiện hình.
 */
class E5EmbeddingModelTest {

    /** Model giả: ghi lại đúng chuỗi được đưa vào embedding. */
    static class Recording implements EmbeddingModel {
        final List<String> seen = new ArrayList<>();

        @Override
        public EmbeddingResponse embed(EmbeddingRequest request) {
            request.inputs().forEach(i -> seen.add(i.text()));
            return EmbeddingResponse.builder()
                    .embeddings(request.inputs().stream().map(i -> Embedding.from(new float[]{1f})).toList())
                    .build();
        }

        @Override
        public Response<Embedding> embed(String text) {
            seen.add(text);
            return Response.from(Embedding.from(new float[]{1f}));
        }

        @Override
        public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
            segments.forEach(s -> seen.add(s.text()));
            return Response.from(segments.stream().map(s -> Embedding.from(new float[]{1f})).toList());
        }

        @Override
        public int dimension() { return 1; }
    }

    private final Recording base = new Recording();
    private final E5EmbeddingModel e5 = new E5EmbeddingModel(base);

    @Test
    @DisplayName("yêu cầu loại QUERY -> 'query: '")
    void queryRequestGetsQueryPrefix() {
        e5.embed(EmbeddingRequest.builder()
                .inputs(List.of(EmbeddingInput.from("làm sao nộp báo cáo")))
                .parameters(EmbeddingRequestParameters.builder().inputType(EmbeddingInputType.QUERY).build())
                .build());

        assertThat(base.seen).containsExactly("query: làm sao nộp báo cáo");
    }

    @Test
    @DisplayName("yêu cầu không ghi loại (đường nạp) -> 'passage: '")
    void untypedRequestGetsPassagePrefix() {
        e5.embed(EmbeddingRequest.builder().inputs(List.of(EmbeddingInput.from("Nộp báo cáo ở tab Của tôi."))).build());

        assertThat(base.seen).containsExactly("passage: Nộp báo cáo ở tab Của tôi.");
    }

    @Test
    @DisplayName("embedAll (ingestor gọi) -> 'passage: ' và metadata giữ nguyên")
    void embedAllUsesPassagePrefix() {
        TextSegment seg = TextSegment.from("đoạn", dev.langchain4j.data.document.Metadata.from("k", "v"));
        e5.embedAll(List.of(seg));

        assertThat(base.seen).containsExactly("passage: đoạn");
        // Đối tượng đưa cho ingestor lưu KHÔNG bị sửa — chữ trong kho không có "passage:".
        assertThat(seg.text()).isEqualTo("đoạn");
    }

    @Test
    @DisplayName("embed(String) (retriever gọi) -> 'query: '")
    void embedStringUsesQueryPrefix() {
        e5.embed("câu hỏi");

        assertThat(base.seen).containsExactly("query: câu hỏi");
    }
}
