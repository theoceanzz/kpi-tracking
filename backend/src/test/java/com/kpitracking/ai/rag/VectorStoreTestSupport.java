package com.kpitracking.ai.rag;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingInputType;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.content.retriever.EmbeddingStoreContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.pgvector.DefaultMetadataStorageConfig;
import dev.langchain4j.store.embedding.pgvector.MetadataStorageMode;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Connection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Kho pgvector THẬT cho các IT truy hồi: cùng cấu hình với {@code LangChain4jConfig.embeddingStore} (HYBRID,
 * {@code simple}, metadata {@code COMBINED_JSONB}) nhưng trên một bảng tạm {@code kg_it_<ngẫu nhiên>}, xoá sau test.
 *
 * <p>Cần DB local có extension {@code vector} (≥ 0.8). Đọc {@code RAG_PG_*} như app, mặc định
 * {@code localhost:5432/kpitracking}, {@code postgres/123456}. Không kết nối được thì IT bị bỏ qua (assume), không đỏ.
 */
final class VectorStoreTestSupport implements AutoCloseable {

    static final int DIM = 384;

    final HikariDataSource dataSource;
    final JdbcTemplate jdbc;
    final String table = "kg_it_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
    final PgVectorEmbeddingStore store;

    private VectorStoreTestSupport(HikariDataSource ds) {
        this.dataSource = ds;
        this.jdbc = new JdbcTemplate(ds);
        this.store = PgVectorEmbeddingStore.datasourceBuilder()
                .datasource(ds)
                .table(table)
                .dimension(DIM)
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

    /** {@code null} khi không có DB/pgvector — test gọi {@code assumeTrue(support != null)}. */
    static VectorStoreTestSupport openOrNull() {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl("jdbc:postgresql://" + env("RAG_PG_HOST", "localhost") + ":" + env("RAG_PG_PORT", "5432")
                + "/" + env("RAG_PG_DATABASE", "kpitracking"));
        cfg.setUsername(env("RAG_PG_USER", "postgres"));
        cfg.setPassword(env("RAG_PG_PASSWORD", "123456"));
        cfg.setMaximumPoolSize(4);
        cfg.setInitializationFailTimeout(-1);
        HikariDataSource ds = new HikariDataSource(cfg);
        try (Connection c = ds.getConnection()) {
            var rs = c.createStatement().executeQuery("SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'");
            rs.next();
            if (rs.getInt(1) == 0) {
                ds.close();
                return null;
            }
        } catch (Exception e) {
            ds.close();
            return null;
        }
        return new VectorStoreTestSupport(ds);
    }

    private static String env(String k, String def) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? def : v;
    }

    /**
     * Bộ truy hồi đúng khuôn của {@code HelpAgentFactory.helpContentRetriever}: embedding truy vấn, HYBRID,
     * {@code minScore = 0}, bộ lọc động do test đưa vào (chính là {@code DocumentAccess.toVectorFilter}).
     */
    ContentRetriever retriever(Filter filter, int maxResults) {
        return EmbeddingStoreContentRetriever.builder()
                .embeddingStore(store)
                .embeddingModel(EMBEDDING)
                .embeddingInputType(EmbeddingInputType.QUERY)
                .maxResults(maxResults)
                .minScore(0.0)
                .dynamicFilter(q -> filter)
                .build();
    }

    /** docId của mọi đoạn truy hồi được cho câu hỏi. */
    static Set<String> docIds(ContentRetriever retriever, String question) {
        return retriever.retrieve(Query.from(question)).stream()
                .map(c -> c.textSegment().metadata().getString("docId"))
                .collect(Collectors.toSet());
    }

    @Override
    public void close() {
        try {
            jdbc.execute("DROP TABLE IF EXISTS " + table);
        } finally {
            dataSource.close();
        }
    }

    /**
     * Embedding giả có tính quyết định: băm từng từ vào một chiều rồi chuẩn hoá. Hai câu chung từ thì gần nhau —
     * đủ cho test về BỘ LỌC, không đo chất lượng model.
     */
    static final EmbeddingModel EMBEDDING = new EmbeddingModel() {
        @Override
        public Response<List<Embedding>> embedAll(List<TextSegment> segments) {
            return Response.from(segments.stream().map(s -> Embedding.from(vectorOf(s.text()))).toList());
        }

        /** Nhận {@code inputType} như E5EmbeddingModel (bộ truy hồi luôn gửi QUERY) — vector không phụ thuộc nó. */
        @Override
        public dev.langchain4j.model.embedding.response.EmbeddingResponse embed(
                dev.langchain4j.model.embedding.request.EmbeddingRequest request) {
            return dev.langchain4j.model.embedding.response.EmbeddingResponse.builder()
                    .embeddings(request.inputs().stream().map(t -> Embedding.from(vectorOf(t.text()))).toList())
                    .build();
        }
    };

    static float[] vectorOf(String text) {
        float[] v = new float[DIM];
        for (String w : text.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (w.isBlank()) continue;
            v[Math.floorMod(w.hashCode(), DIM)] += 1f;
        }
        double n = 0;
        for (float x : v) n += x * x;
        if (n == 0) {
            v[0] = 1f;
            return v;
        }
        float inv = (float) (1.0 / Math.sqrt(n));
        for (int i = 0; i < DIM; i++) v[i] *= inv;
        return v;
    }
}
