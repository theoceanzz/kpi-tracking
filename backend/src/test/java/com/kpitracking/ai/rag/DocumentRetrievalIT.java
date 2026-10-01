package com.kpitracking.ai.rag;

import com.kpitracking.entity.Document;
import com.kpitracking.enums.DocumentCategory;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolverTestHook;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.*;
import java.util.stream.Collectors;

import static com.kpitracking.ai.rag.VectorStoreTestSupport.docIds;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Truy hồi theo quyền trên pgvector THẬT — bộ test chặn merge của docs/DOCUMENTS_DESIGN.md §6.5 (kịch bản 1–13, 16).
 *
 * <p>Chạy tay: {@code ./mvnw test -Dtest='DocumentRetrieval*IT'} (tên kết thúc bằng IT nên {@code mvn test} bỏ qua).
 * Dùng bảng vector tạm, xoá sau khi chạy; không đụng dữ liệu thật.
 *
 * <p>Cách kiểm: mỗi tài liệu giả vừa là một {@link Document} (để hỏi {@code DocumentAccess.canView} — đúng thứ màn
 * danh sách dùng) vừa là một đoạn trong kho. Với mỗi người hỏi, tập docId bộ truy hồi trả về phải ĐÚNG BẰNG tập
 * tài liệu {@code canView} cho qua (+ bộ hướng dẫn chung) — không thừa (rò) và không thiếu.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DocumentRetrievalIT {

    static VectorStoreTestSupport kb;

    static final UUID ORG = UUID.randomUUID(), OTHER_ORG = UUID.randomUUID();
    static final UUID ME = UUID.randomUUID(), OTHER = UUID.randomUUID();
    static final UUID ROOT = UUID.randomUUID(), X = UUID.randomUUID(), X1 = UUID.randomUUID(),
            X2 = UUID.randomUUID(), Y = UUID.randomUUID();
    static final Map<UUID, String> UNITS = new LinkedHashMap<>();

    /** Tài liệu "hợp lệ" — mọi thứ trong đây đều có metadata đầy đủ. */
    static final Map<String, Document> DOCS = new LinkedHashMap<>();
    static final String GUIDE = "guide", LEGACY = "legacy",
            NO_SCOPE = "broken-no-scope", UNIT_NO_ID = "broken-unit-no-id",
            PERSONAL_NO_OWNER = "broken-personal-no-owner", GUIDE_NO_SCOPE = "broken-guide-no-scope";

    static final String QUESTION = "quy chế lương thưởng";

    @BeforeAll
    static void seed() {
        kb = VectorStoreTestSupport.openOrNull();
        assumeTrue(kb != null, "Cần PostgreSQL local có pgvector");

        UNITS.put(ROOT, "/KPC/");
        UNITS.put(X, "/KPC/" + X + "/");
        UNITS.put(X1, "/KPC/" + X + "/" + X1 + "/");
        UNITS.put(X2, "/KPC/" + X + "/" + X2 + "/");
        UNITS.put(Y, "/KPC/" + Y + "/");

        company("company", ORG, DocumentCategory.REGULATION);
        company("company-jd", ORG, DocumentCategory.JOB_DESCRIPTION);
        company("other-org", OTHER_ORG, DocumentCategory.REGULATION);
        for (Map.Entry<UUID, String> u : UNITS.entrySet()) {
            unit("unit-" + name(u.getKey()), u.getKey(), DocumentCategory.REGULATION);
        }
        unit("unit-X-jd", X, DocumentCategory.JOB_DESCRIPTION);
        unit("unit-Y-jd", Y, DocumentCategory.JOB_DESCRIPTION);
        personal("personal-me", ME);
        personal("personal-other", OTHER);

        for (Map.Entry<String, Document> e : DOCS.entrySet()) add(e.getKey(), metadataOf(e.getValue()));
        add(GUIDE, Map.of("orgId", "GLOBAL", "scope", "GLOBAL"));

        // Vector hỏng / cũ — KHÔNG ai được truy hồi (kịch bản 11–13) cho tới khi được gắn scope.
        add(LEGACY, Map.of("orgId", ORG.toString(), "source", "REGULATION"));
        add(NO_SCOPE, Map.of("orgId", ORG.toString()));
        add(UNIT_NO_ID, Map.of("orgId", ORG.toString(), "scope", "UNIT"));
        add(PERSONAL_NO_OWNER, Map.of("orgId", ORG.toString(), "scope", "PERSONAL"));
        add(GUIDE_NO_SCOPE, Map.of("orgId", "GLOBAL"));
    }

    @AfterAll
    static void drop() {
        if (kb != null) kb.close();
    }

    // ── Dữ liệu ─────────────────────────────────────────────────────────────────────────────────────

    static String name(UUID unit) {
        return unit.equals(ROOT) ? "ROOT" : unit.equals(X) ? "X" : unit.equals(X1) ? "X1" : unit.equals(X2) ? "X2" : "Y";
    }

    static void company(String key, UUID org, DocumentCategory c) {
        DOCS.put(key, Document.builder().id(UUID.randomUUID()).organizationId(org).scope(DocumentScope.COMPANY).category(c).build());
    }

    static void unit(String key, UUID unit, DocumentCategory c) {
        DOCS.put(key, Document.builder().id(UUID.randomUUID()).organizationId(ORG).scope(DocumentScope.UNIT)
                .orgUnitId(unit).category(c).build());
    }

    static void personal(String key, UUID owner) {
        DOCS.put(key, Document.builder().id(UUID.randomUUID()).organizationId(ORG).scope(DocumentScope.PERSONAL)
                .ownerUserId(owner).category(DocumentCategory.OTHER).build());
    }

    /** Đúng metadata mà DocumentIndexer ghi. */
    static Map<String, Object> metadataOf(Document d) {
        Map<String, Object> m = new HashMap<>();
        m.put("orgId", d.getOrganizationId().toString());
        m.put("scope", d.getScope().name());
        if (d.getOrgUnitId() != null) m.put("unitId", d.getOrgUnitId().toString());
        if (d.getOwnerUserId() != null) m.put("ownerId", d.getOwnerUserId().toString());
        m.put("category", d.getCategory().name());
        return m;
    }

    /** Mọi đoạn cùng nội dung khớp câu hỏi — để chỉ BỘ LỌC quyết định ai thấy gì. */
    static void add(String key, Map<String, Object> meta) {
        Map<String, Object> m = new HashMap<>(meta);
        m.put("docId", key);
        m.put("title", key);
        m.put("parent", "");
        String text = "Quy chế lương thưởng và phúc lợi — " + key;
        kb.store.add(Embedding.from(VectorStoreTestSupport.vectorOf(text)), TextSegment.from(text, Metadata.from(m)));
    }

    static DocumentAccess accessOf(UUID user, UUID org, Map<UUID, Set<String>> memberships) {
        return DocumentAccessResolverTestHook.compute(org, user, memberships, UNITS);
    }

    /** Tập docId người này PHẢI thấy: đúng những gì canView cho qua, cộng bộ hướng dẫn chung. */
    static Set<String> expected(DocumentAccess a, Set<String> extra) {
        Set<String> out = DOCS.entrySet().stream().filter(e -> a.canView(e.getValue()))
                .map(Map.Entry::getKey).collect(Collectors.toCollection(HashSet::new));
        out.addAll(extra);
        return out;
    }

    static Set<String> retrieve(DocumentAccess a) {
        return docIds(kb.retriever(a.toVectorFilter(true), 100), QUESTION);
    }

    static final Set<String> STAFF = Set.of("DOCUMENT:UPLOAD_PERSONAL");
    static final Set<String> HEAD = Set.of("DOCUMENT:UPLOAD_PERSONAL", "DOCUMENT:MANAGE_UNIT");

    // ── Kịch bản ────────────────────────────────────────────────────────────────────────────────────

    @Test
    @Order(1)
    @DisplayName("1,3,5,10–13: nhân viên tổ X1 thấy đúng tập canView — không tài liệu cá nhân người khác, không X2/Y, không vector hỏng")
    void staffOfX1() {
        DocumentAccess a = accessOf(ME, ORG, Map.of(X1, STAFF));
        Set<String> got = retrieve(a);
        assertThat(got).isEqualTo(expected(a, Set.of(GUIDE)));
        assertThat(got).contains("company", "unit-X", "unit-X1", "unit-ROOT", "personal-me", GUIDE)
                .doesNotContain("personal-other", "unit-X2", "unit-Y", "other-org",
                        LEGACY, NO_SCOPE, UNIT_NO_ID, PERSONAL_NO_OWNER, GUIDE_NO_SCOPE);
    }

    @Test
    @Order(2)
    @DisplayName("2,4: trưởng phòng X thấy cả cây con X1, X2; không thấy phòng Y ngang hàng")
    void headOfX() {
        DocumentAccess a = accessOf(ME, ORG, Map.of(X, HEAD));
        Set<String> got = retrieve(a);
        assertThat(got).isEqualTo(expected(a, Set.of(GUIDE)));
        assertThat(got).contains("unit-X1", "unit-X2").doesNotContain("unit-Y", "personal-other");
    }

    @Test
    @Order(3)
    @DisplayName("admin (SYSTEM:ADMIN) thấy mọi đơn vị nhưng KHÔNG thấy tài liệu cá nhân của người khác; vẫn không thấy vector hỏng")
    void adminStillCannotReadOthersPersonal() {
        DocumentAccess a = accessOf(ME, ORG, Map.of(ROOT, Set.of("SYSTEM:ADMIN")));
        Set<String> got = retrieve(a);
        assertThat(got).isEqualTo(expected(a, Set.of(GUIDE)));
        assertThat(got).contains("unit-Y", "unit-X2").doesNotContain("personal-other", LEGACY, NO_SCOPE);
    }

    @Test
    @Order(4)
    @DisplayName("6: người tổ chức khác chỉ thấy tài liệu công ty của họ + hướng dẫn chung")
    void otherOrganization() {
        DocumentAccess a = accessOf(OTHER, OTHER_ORG, Map.of(ROOT, STAFF));
        assertThat(retrieve(a)).containsExactlyInAnyOrder("other-org", GUIDE);
    }

    @Test
    @Order(5)
    @DisplayName("không có vai trò trong tổ chức → chỉ hướng dẫn chung")
    void nonMember() {
        DocumentAccess a = DocumentAccess.none(ORG, ME);
        assertThat(retrieve(a)).containsExactly(GUIDE);
    }

    @Test
    @Order(6)
    @DisplayName("7: chuyển từ tổ X1 sang phòng Y → mất tài liệu X ngay, không cần nạp lại")
    void movedUnit() {
        DocumentAccess a = accessOf(ME, ORG, Map.of(Y, STAFF));
        Set<String> got = retrieve(a);
        assertThat(got).contains("unit-Y").doesNotContain("unit-X", "unit-X1");
        assertThat(got).isEqualTo(expected(a, Set.of(GUIDE)));
    }

    @Test
    @Order(7)
    @DisplayName("9: get_org_documents của nhân viên phòng Y — JD công ty + JD phòng Y, KHÔNG có JD phòng X")
    void toolCategories() {
        DocumentAccess a = accessOf(ME, ORG, Map.of(Y, STAFF));
        Set<String> got = docIds(kb.retriever(a.toVectorFilter(List.of(DocumentCategory.JOB_DESCRIPTION,
                DocumentCategory.STRATEGY)), 100), QUESTION);
        assertThat(got).containsExactlyInAnyOrder("company-jd", "unit-Y-jd");
    }

    @Test
    @Order(8)
    @DisplayName("8: xoá / tắt AI (xoá vector theo docId) → 0 đoạn ngay")
    void deletedDocumentDisappears() {
        String id = "unit-X2";
        DocumentAccess a = accessOf(ME, ORG, Map.of(X, HEAD));
        assertThat(retrieve(a)).contains(id);
        kb.store.removeAll(dev.langchain4j.store.embedding.filter.MetadataFilterBuilder.metadataKey("docId").isEqualTo(id));
        assertThat(retrieve(a)).doesNotContain(id);
        add(id, metadataOf(DOCS.get(id))); // trả lại cho các test sau
    }

    @Test
    @Order(20)
    @DisplayName("11,13 → khởi động: gắn scope cho vector cũ (COMPANY/GLOBAL), vector hỏng khác vẫn không ai đọc; index orgId/scope có mặt")
    void initializerTagsLegacyVectors() {
        DocumentAccess staff = accessOf(ME, ORG, Map.of(X1, STAFF));
        assertThat(retrieve(staff)).doesNotContain(LEGACY, GUIDE_NO_SCOPE);

        VectorStoreSchemaInitializer init = new VectorStoreSchemaInitializer(kb.dataSource, kb.table, false);
        init.run(null);
        init.run(null); // idempotent

        Set<String> got = retrieve(staff);
        assertThat(got).contains(LEGACY, GUIDE_NO_SCOPE);
        // Không đoán được phạm vi của đoạn UNIT thiếu unitId / PERSONAL thiếu ownerId → vẫn không ai đọc.
        assertThat(got).doesNotContain(UNIT_NO_ID, PERSONAL_NO_OWNER);
        // Vector không có orgId thì không được gắn gì.
        assertThat(kb.jdbc.queryForObject("SELECT metadata->>'category' FROM " + kb.table
                + " WHERE metadata->>'docId' = ?", String.class, LEGACY)).isEqualTo("REGULATION");
        assertThat(kb.jdbc.queryForObject("SELECT count(*) FROM pg_indexes WHERE indexname = ?", Integer.class,
                init.orgScopeIndexName())).isEqualTo(1);
    }

    @Test
    @Order(30)
    @DisplayName("16: có index HNSW trên bảng vector → khởi động thất bại (trừ khi allow-ann-index)")
    void annIndexFailsStartup() {
        kb.jdbc.execute("CREATE INDEX " + kb.table + "_hnsw ON " + kb.table + " USING hnsw (embedding vector_cosine_ops)");
        try {
            assertThatThrownBy(() -> new VectorStoreSchemaInitializer(kb.dataSource, kb.table, false).run(null))
                    .isInstanceOf(IllegalStateException.class).hasMessageContaining("ANN");
            new VectorStoreSchemaInitializer(kb.dataSource, kb.table, true).run(null); // cờ bật: chỉ cảnh báo
        } finally {
            kb.jdbc.execute("DROP INDEX IF EXISTS " + kb.table + "_hnsw");
        }
    }
}
