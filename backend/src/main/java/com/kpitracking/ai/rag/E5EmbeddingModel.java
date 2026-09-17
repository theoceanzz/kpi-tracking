package com.kpitracking.ai.rag;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInput;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.model.embedding.request.EmbeddingRequest;
import dev.langchain4j.model.embedding.response.EmbeddingResponse;
import dev.langchain4j.model.output.Response;

import java.util.List;

/**
 * Bọc model họ E5 để tự thêm tiền tố mà model đòi hỏi.
 *
 * <p>E5 được huấn luyện với hai tiền tố: {@code "query: "} cho câu hỏi và {@code "passage: "} cho
 * đoạn tài liệu. Bỏ tiền tố thì vector vẫn ra nhưng độ khớp tụt rõ — đây là lỗi âm thầm điển
 * hình: không có ngoại lệ, chỉ có kết quả tìm kiếm kém đi mà không ai biết vì sao.
 *
 * <p>Quyết định theo {@link EmbeddingRequest#inputType()}: {@code QUERY} → "query: ", còn lại →
 * "passage: ". {@code EmbeddingStoreContentRetriever} được dựng với
 * {@code embeddingInputType(QUERY)} nên đường hỏi luôn đi đúng nhánh; đường nạp không đặt loại
 * nên rơi về "passage: ". Hai lối tắt {@code embed(String)} (chỉ retriever gọi) và
 * {@code embedAll(List)} (chỉ ingestor gọi) cũng được đặt loại tường minh cho chắc.
 *
 * <p>Tiền tố KHÔNG lọt vào chữ lưu trong kho — chỉ đi vào vector — nên full-text của chế độ hybrid
 * không bị một từ "passage" vô nghĩa chen vào.
 */
public final class E5EmbeddingModel implements EmbeddingModel {

    private static final String QUERY_PREFIX = "query: ";
    private static final String PASSAGE_PREFIX = "passage: ";

    private final EmbeddingModel delegate;

    public E5EmbeddingModel(EmbeddingModel delegate) {
        this.delegate = delegate;
    }

    @Override
    public EmbeddingResponse embed(EmbeddingRequest request) {
        String prefix = request.inputType() == EmbeddingInputType.QUERY ? QUERY_PREFIX : PASSAGE_PREFIX;
        List<EmbeddingInput> prefixed = request.inputs().stream()
                .map(in -> EmbeddingInput.from(prefix + in.text()))
                .toList();
        // KHÔNG chuyển tiếp parameters: inputType đã được tiêu thụ thành tiền tố ở trên, và model
        // ONNX từ chối mọi tham số theo lời gọi mà nó không hiểu (đo được: UnsupportedFeatureException).
        return delegate.embed(EmbeddingRequest.builder().inputs(prefixed).build());
    }

    @Override
    public Response<Embedding> embed(String text) {
        return delegate.embed(QUERY_PREFIX + text);
    }

    @Override
    public Response<Embedding> embed(TextSegment segment) {
        return delegate.embed(PASSAGE_PREFIX + segment.text());
    }

    @Override
    public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
        return delegate.embedAll(segments.stream()
                .map(s -> TextSegment.from(PASSAGE_PREFIX + s.text(), s.metadata()))
                .toList());
    }

    @Override
    public int dimension() {
        return delegate.dimension();
    }

    @Override
    public String modelName() {
        return "e5:" + delegate.modelName();
    }
}
