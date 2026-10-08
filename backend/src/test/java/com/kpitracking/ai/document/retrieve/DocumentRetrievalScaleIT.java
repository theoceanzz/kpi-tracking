package com.kpitracking.ai.document.retrieve;

import com.kpitracking.ai.document.store.VectorStoreSchemaInitializer;
import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolverTestHook;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.rag.content.Content;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Lọc CHỌN LỌC trên dữ liệu lớn — kịch bản 14–15 của docs/DOCUMENTS_DESIGN.md §6.5, cũng là bằng chứng cho quyết
 * định "không index ANN" ở §6.6. Với index ANN, lọc chạy SAU top-K: người chỉ được xem vài đoạn giữa hàng chục
 * nghìn đoạn nhận về 0 hoặc thiếu kết quả. Test này phải qua trên đúng cấu hình app đang chạy (tìm chính xác +
 * index biểu thức orgId/scope do {@link VectorStoreSchemaInitializer} tạo).
 *
 * <p>~50.000 đoạn, 384 chiều, cùng MỘT tổ chức (trường hợp xấu nhất cho lọc theo tổ chức). Nạp mất ~20–40 giây.
 * Chạy tay: {@code ./mvnw test -Dtest='DocumentRetrieval*IT'}.
 */
class DocumentRetrievalScaleIT {

    static VectorStoreTestSupport kb;

    static final UUID ORG = UUID.randomUUID(), OTHER_ORG = UUID.randomUUID();
    static final UUID ME = UUID.randomUUID(), OTHER = UUID.randomUUID();
    static final UUID ROOT = UUID.randomUUID(), UA = UUID.randomUUID(), UX = UUID.randomUUID(), UZ = UUID.randomUUID();
    static final Map<UUID, String> UNITS = new LinkedHashMap<>();

    static final int TOTAL = 50_000;
    static final String QUESTION = "ghi chú cá nhân về lương thưởng";

    @BeforeAll
    static void seed() {
        kb = VectorStoreTestSupport.openOrNull();
        assumeTrue(kb != null, "Cần PostgreSQL local có pgvector");
        UNITS.put(ROOT, "/KPC/");
        UNITS.put(UA, "/KPC/" + UA + "/");
        UNITS.put(UX, "/KPC/" + UX + "/");
        UNITS.put(UZ, "/KPC/" + UZ + "/");

        // 5 đoạn cá nhân của người hỏi — nội dung khớp câu hỏi, embedding thật từ bộ băm của test.
        for (int i = 0; i < 5; i++) {
            addReal("me-" + i, Map.of("orgId", ORG.toString(), "scope", "PERSONAL", "ownerId", ME.toString()),
                    "Ghi chú cá nhân về lương thưởng quý " + i);
        }
        // Phần còn lại nạp thẳng bằng SQL (vector ngẫu nhiên) — nhanh, và chỉ BỘ LỌC là thứ đang được kiểm.
        //   15 đoạn đơn vị UA, 1.980 đoạn cá nhân của người khác, 38.000 đoạn đơn vị UX, 10.000 đoạn công ty khác.
        kb.jdbc.execute("INSERT INTO " + kb.table + " (embedding_id, embedding, text, metadata) "
                + "SELECT gen_random_uuid(), (SELECT array_agg(random() - 0.5) FROM generate_series(1, 384) WHERE g > 0)::vector, "
                + "'ghi chú lương thưởng ' || g, "
                + "CASE WHEN g <= 15    THEN jsonb_build_object('docId', 'ua-' || g, 'orgId', '" + ORG + "', 'scope', 'UNIT', 'unitId', '" + UA + "') "
                + "     WHEN g <= 1995  THEN jsonb_build_object('docId', 'other-' || g, 'orgId', '" + ORG + "', 'scope', 'PERSONAL', 'ownerId', '" + OTHER + "') "
                + "     WHEN g <= 39995 THEN jsonb_build_object('docId', 'ux-' || g, 'orgId', '" + ORG + "', 'scope', 'UNIT', 'unitId', '" + UX + "') "
                + "     ELSE jsonb_build_object('docId', 'o2-' || g, 'orgId', '" + OTHER_ORG + "', 'scope', 'COMPANY') END "
                + "FROM generate_series(1, " + (TOTAL - 5) + ") g");
        // Đúng cấu hình khởi động của app: index biểu thức + chốt chặn ANN.
        new VectorStoreSchemaInitializer(kb.dataSource, kb.table, false).run(null);
        kb.jdbc.execute("ANALYZE " + kb.table);
        assertThat(kb.jdbc.queryForObject("SELECT count(*) FROM " + kb.table, Integer.class)).isEqualTo(TOTAL);
    }

    @AfterAll
    static void drop() {
        if (kb != null) kb.close();
    }

    static void addReal(String docId, Map<String, Object> meta, String text) {
        Map<String, Object> m = new HashMap<>(meta);
        m.put("docId", docId);
        m.put("title", docId);
        m.put("parent", "");
        kb.store.add(Embedding.from(VectorStoreTestSupport.vectorOf(text)), TextSegment.from(text, Metadata.from(m)));
    }

    static List<String> retrieve(DocumentAccess a, int maxResults) {
        long t0 = System.nanoTime();
        List<Content> hits = kb.retrieve(RetrievalProfile.HELP, a, null, QUESTION, maxResults);
        long ms = (System.nanoTime() - t0) / 1_000_000;
        System.out.printf("[DocumentRetrievalScaleIT] %d đoạn trong %d ms%n", hits.size(), ms);
        return hits.stream().map(c -> c.textSegment().metadata().getString("docId")).toList();
    }

    @Test
    @DisplayName("14: người hỏi chỉ được xem 5 đoạn cá nhân giữa ~50.000 đoạn cùng tổ chức → nhận đủ 5")
    void fewVisibleAmongMany() {
        DocumentAccess me = DocumentAccessResolverTestHook.compute(ORG, ME,
                Map.of(UZ, Set.of("DOCUMENT:UPLOAD_PERSONAL")), UNITS);
        List<String> got = retrieve(me, 6);
        assertThat(got).hasSize(5).allMatch(id -> id.startsWith("me-"));
    }

    @Test
    @DisplayName("15: xem được 20 đoạn (5 cá nhân + 15 đơn vị UA), maxResults = 6 → nhận đủ 6, toàn đoạn được phép")
    void moreVisibleThanMaxResults() {
        DocumentAccess me = DocumentAccessResolverTestHook.compute(ORG, ME,
                Map.of(UA, Set.of("DOCUMENT:UPLOAD_PERSONAL")), UNITS);
        List<String> got = retrieve(me, 6);
        assertThat(got).hasSize(6).allMatch(id -> id.startsWith("me-") || id.startsWith("ua-"));
        // Đoạn khớp nội dung nhất (cá nhân, cùng từ với câu hỏi) phải đứng trong kết quả.
        assertThat(got).anyMatch(id -> id.startsWith("me-"));
    }

    @Test
    @DisplayName("trường hợp nặng nhất của tìm chính xác: admin thấy ~40.000 đoạn của tổ chức → vẫn đủ 6, không lọt đoạn cá nhân người khác")
    void adminSeesWholeOrganization() {
        DocumentAccess admin = DocumentAccessResolverTestHook.compute(ORG, ME, Map.of(ROOT, Set.of("SYSTEM:ADMIN")), UNITS);
        List<String> got = retrieve(admin, 6);
        assertThat(got).hasSize(6).noneMatch(id -> id.startsWith("other-") || id.startsWith("o2-"));
    }
}
