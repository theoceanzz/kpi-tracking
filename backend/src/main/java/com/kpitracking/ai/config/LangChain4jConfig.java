package com.kpitracking.ai.config;

import com.kpitracking.ai.rag.E5EmbeddingModel;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.onnx.OnnxEmbeddingModel;
import dev.langchain4j.model.embedding.onnx.PoolingMode;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.DefaultMetadataStorageConfig;
import dev.langchain4j.store.embedding.pgvector.MetadataStorageMode;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/**
 * Bean langchain4j dùng chung cho toàn bộ trợ lý.
 *
 * <p>Đúng MỘT bean cho mỗi vai (chat, streaming, embedding, kho vector). Mọi agent nhận qua
 * {@code AgentDeps}; không agent nào tự dựng model riêng — đó là cách duy nhất để
 * {@link TokenUsageListener} bao trọn 100% lượt gọi.
 */
@Configuration
@Slf4j
public class LangChain4jConfig {

    @Value("${app.ai.model.base-url}") private String baseUrl;
    @Value("${app.ai.model.api-key}") private String apiKey;
    @Value("${app.ai.model.name}") private String modelName;
    @Value("${app.ai.model.temperature:0}") private double temperature;
    @Value("${app.ai.model.max-tokens:8192}") private int maxTokens;
    @Value("${app.ai.model.timeout-seconds:90}") private long timeoutSeconds;
    /**
     * Mức suy luận của gpt-oss. Cấu hình cũ đo được: high suy luận quá nhiều → chậm và dễ chạm
     * LENGTH trước khi kịp sinh chữ; low dễ chọn sai tool. medium là mức cân bằng cho tool-use.
     * Quên đặt ở đây là model chạy mức mặc định của nhà cung cấp — hành vi lệch hẳn bản đã đo.
     */
    @Value("${app.ai.model.reasoning-effort:medium}") private String reasoningEffort;
    /** Ghi nguyên request/response gửi nhà cung cấp — CHỈ để chẩn đoán, prompt có dữ liệu thật. */
    @Value("${app.ai.model.log-requests:false}") private boolean logRequests;

    @Bean
    public ChatModel chatModel(TokenUsageListener tokenUsageListener) {
        return OpenAiChatModel.builder()
                .baseUrl(baseUrl)
                .reasoningEffort(reasoningEffort)
                .logRequests(logRequests)
                .logResponses(logRequests)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                // Một lần là đủ: lớp trên đã có cửa thoát hiểm và hạn mức; tự thử lại ở đây chỉ nhân
                // đôi thời gian chờ và tiền token khi nhà cung cấp đang nghẽn.
                .maxRetries(1)
                .listeners(List.of(tokenUsageListener))
                .build();
    }

    @Bean
    public StreamingChatModel streamingChatModel(TokenUsageListener tokenUsageListener) {
        return OpenAiStreamingChatModel.builder()
                .baseUrl(baseUrl)
                .reasoningEffort(reasoningEffort)
                .logRequests(logRequests)
                .logResponses(logRequests)
                .apiKey(apiKey)
                .modelName(modelName)
                .temperature(temperature)
                .maxTokens(maxTokens)
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .listeners(List.of(tokenUsageListener))
                .build();
    }

    // ── RAG ──────────────────────────────────────────────────────────────────

    @Value("${app.ai.rag.embedding.model-path}") private String embeddingModelPath;
    @Value("${app.ai.rag.embedding.tokenizer-path}") private String embeddingTokenizerPath;
    @Value("${app.ai.rag.embedding.dimension}") private int embeddingDimension;
    @Value("${app.ai.rag.embedding.table}") private String embeddingTable;
    @Value("${app.ai.rag.vector-store.host}") private String pgHost;
    @Value("${app.ai.rag.vector-store.port}") private int pgPort;
    @Value("${app.ai.rag.vector-store.database}") private String pgDatabase;
    @Value("${app.ai.rag.vector-store.user}") private String pgUser;
    @Value("${app.ai.rag.vector-store.password}") private String pgPassword;

    /**
     * Embedding chạy tại chỗ bằng ONNX Runtime — không mạng, không phí.
     *
     * <p>Thiếu tệp model thì báo rõ cách lấy thay vì để ONNX ném một stack trace khó hiểu lúc khởi
     * động. Đường dẫn tương đối tính từ thư mục làm việc (backend/ khi chạy jar, hoặc gốc dự án
     * khi chạy qua IDE) nên thử cả hai.
     */
    @Bean
    public EmbeddingModel embeddingModel() {
        Path model = locate(embeddingModelPath);
        Path tokenizer = locate(embeddingTokenizerPath);
        log.info("Nạp model embedding tại chỗ: {}", model.toAbsolutePath());
        // Bọc E5 để tự thêm tiền tố query:/passage: — xem E5EmbeddingModel.
        return new E5EmbeddingModel(new OnnxEmbeddingModel(model, tokenizer, PoolingMode.MEAN));
    }

    private static Path locate(String configured) {
        Path direct = Path.of(configured);
        if (Files.exists(direct)) return direct;
        Path underBackend = Path.of("backend").resolve(configured);
        if (Files.exists(underBackend)) return underBackend;
        throw new IllegalStateException("Không thấy tệp model embedding '" + configured
                + "'. Chạy: bash backend/fetch-embedding-model.sh");
    }

    /**
     * Kho vector trên pgvector, chế độ HYBRID: cosine trên vector CỘNG full-text PostgreSQL, gộp
     * bằng RRF. Full-text bắt được mã màn hình, tên nút, từ khoá hiếm mà vector hay trượt.
     *
     * <p>{@code textSearchConfig = "simple"}: PostgreSQL không có bộ từ điển tiếng Việt, và
     * {@code simple} (tách theo khoảng trắng, hạ chữ thường) là đúng thứ cần cho tiếng Việt có dấu.
     *
     * <p>Kho này KHÔNG qua Flyway: langchain4j tự tạo bảng, và ở dev nó nằm trên một DB khác
     * (container pgvector) vì PG13 cục bộ không có extension.
     */
    @Bean
    public EmbeddingStore<TextSegment> embeddingStore() {
        return PgVectorEmbeddingStore.builder()
                .host(pgHost).port(pgPort).database(pgDatabase).user(pgUser).password(pgPassword)
                .table(embeddingTable)
                .dimension(embeddingDimension)
                .createTable(true)
                .searchMode(PgVectorEmbeddingStore.SearchMode.HYBRID)
                .textSearchConfig("simple")
                .metadataStorageConfig(DefaultMetadataStorageConfig.builder()
                        .storageMode(MetadataStorageMode.COMBINED_JSONB)
                        .columnDefinitions(List.of("metadata JSONB NULL"))
                        .indexes(List.of("metadata"))
                        .indexType("GIN")
                        .build())
                .build();
    }
}
