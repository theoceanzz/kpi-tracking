package com.kpitracking.ai.document.store;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Việc trên bảng vector mà Flyway không làm được — bảng do langchain4j tự tạo, nằm ngoài Flyway và có thể ở
 * DB khác (docs/DOCUMENTS_DESIGN.md §4, §6.2, §6.6). Chạy mỗi lần khởi động, idempotent:
 *
 * <ol>
 *   <li><b>Gắn {@code scope} cho vector cũ</b> (nạp trước khi có thư viện tài liệu). Bộ lọc truy hồi là
 *       fail-closed: vector thiếu {@code scope} không ai đọc được, nên phải gắn TRƯỚC khi app nhận request.</li>
 *   <li><b>Index B-tree biểu thức</b> {@code ((metadata->>'orgId'), (metadata->>'scope'))}: để lọc thu về
 *       phần của một tổ chức trước khi tính khoảng cách chính xác. {@code CONCURRENTLY} để không khoá ghi.</li>
 *   <li><b>Chốt chặn index ANN</b>: thấy index {@code hnsw}/{@code ivfflat} trên bảng thì KHỞI ĐỘNG THẤT BẠI,
 *       trừ khi {@code app.ai.rag.allow-ann-index=true}. Đã đo (§6.6): với ANN, lọc chạy SAU top-K nên người
 *       chỉ được xem vài đoạn nhận về 0 hoặc thiếu kết quả — kể cả khi bật {@code hnsw.iterative_scan}.</li>
 * </ol>
 */
@Slf4j
public class VectorStoreSchemaInitializer implements ApplicationRunner {

    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[a-zA-Z_][a-zA-Z0-9_]*");

    private final JdbcTemplate jdbc;
    private final String table;
    private final boolean allowAnnIndex;

    public VectorStoreSchemaInitializer(DataSource dataSource, String table, boolean allowAnnIndex) {
        if (!SAFE_IDENTIFIER.matcher(table).matches()) {
            throw new IllegalArgumentException("Tên bảng vector không hợp lệ: " + table);
        }
        this.jdbc = new JdbcTemplate(dataSource);
        this.table = table;
        this.allowAnnIndex = allowAnnIndex;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!tableExists()) {
            log.warn("Chưa có bảng vector {} — bỏ qua khởi tạo (kho tri thức chưa dùng lần nào)", table);
            return;
        }
        logVersion();
        tagLegacyVectors();
        ensureOrgScopeIndex();
        guardAgainstAnnIndex();
    }

    /** Tên index biểu thức, cho test đối chiếu. */
    public String orgScopeIndexName() {
        return table + "_org_scope_idx";
    }

    private boolean tableExists() {
        Boolean exists = jdbc.queryForObject("SELECT to_regclass(?) IS NOT NULL", Boolean.class, table);
        return Boolean.TRUE.equals(exists);
    }

    private void logVersion() {
        List<String> v = jdbc.queryForList("SELECT extversion FROM pg_extension WHERE extname = 'vector'", String.class);
        log.info("pgvector {} — bảng {}, tìm chính xác (không index ANN)", v.isEmpty() ? "?" : v.get(0), table);
    }

    /** Gắn scope cho vector nạp trước thư viện tài liệu. Chạy lại không đổi gì (chỉ đụng dòng CHƯA có scope). */
    void tagLegacyVectors() {
        int global = jdbc.update("UPDATE " + table
                + " SET metadata = metadata || '{\"scope\":\"GLOBAL\"}'::jsonb"
                + " WHERE metadata->>'orgId' = 'GLOBAL' AND metadata->'scope' IS NULL");
        // Tài liệu cũ của tổ chức (rag_documents): coi là tài liệu CÔNG TY, category = source cũ để công cụ
        // gợi ý KPI (lọc JOB_DESCRIPTION/STRATEGY) vẫn tìm thấy.
        int company = jdbc.update("UPDATE " + table
                + " SET metadata = metadata || jsonb_build_object('scope', 'COMPANY', 'category', COALESCE(metadata->>'source', 'OTHER'))"
                + " WHERE metadata->'orgId' IS NOT NULL AND metadata->>'orgId' <> 'GLOBAL' AND metadata->'scope' IS NULL");
        if (global + company > 0) {
            log.info("Đã gắn scope cho vector cũ: {} đoạn GLOBAL, {} đoạn COMPANY", global, company);
        }
    }

    void ensureOrgScopeIndex() {
        String name = orgScopeIndexName();
        // Lần trước CONCURRENTLY hỏng giữa chừng thì còn lại một index INVALID mà IF NOT EXISTS sẽ bỏ qua mãi.
        List<Boolean> valid = jdbc.queryForList(
                "SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ?",
                Boolean.class, name);
        if (!valid.isEmpty() && !Boolean.TRUE.equals(valid.get(0))) {
            log.warn("Index {} đang INVALID — tạo lại", name);
            jdbc.execute("DROP INDEX CONCURRENTLY IF EXISTS " + name);
        }
        jdbc.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS " + name + " ON " + table
                + " ((metadata->>'orgId'), (metadata->>'scope'))");
    }

    void guardAgainstAnnIndex() {
        List<String> ann = jdbc.queryForList(
                "SELECT indexname FROM pg_indexes WHERE tablename = ? AND indexdef ~* 'using (hnsw|ivfflat)'",
                String.class, table);
        if (ann.isEmpty()) return;
        if (allowAnnIndex) {
            log.warn("Bảng vector {} có index ANN {} và app.ai.rag.allow-ann-index=true — lọc theo quyền có thể "
                    + "trả THIẾU kết quả (docs/DOCUMENTS_DESIGN.md §6.6). Phải chạy lại DocumentRetrievalScaleIT.", table, ann);
            return;
        }
        throw new IllegalStateException("Bảng vector " + table + " có index ANN " + ann + ". Với index ANN, bộ lọc "
                + "theo quyền chạy sau top-K và trả thiếu kết quả (đã đo, docs/DOCUMENTS_DESIGN.md §6.6). Xoá index "
                + "đó, hoặc đặt app.ai.rag.allow-ann-index=true SAU KHI DocumentRetrievalScaleIT qua.");
    }
}
