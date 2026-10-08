package com.kpitracking.ai.document.retrieve;

import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolver;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.Filter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Chốt chặn của MỌI lần đọc kho tri thức nằm ở {@link DocumentRetrieverFactory#filterFor}. Lọt ở đây là tổ chức này
 * đọc được quy chế của tổ chức khác, hay một người đọc được tài liệu cá nhân của người khác.
 *
 * <p>Kiểm theo NGỮ NGHĨA ({@link Filter#test}: đoạn có metadata này lọt hay bị chặn), không theo hình dạng cây bộ
 * lọc — đổi cách dựng bộ lọc mà vẫn đúng thì test không phải sửa.
 */
class DocumentRetrieverFactoryTest {

    private final String org = UUID.randomUUID().toString();
    private final String otherOrg = UUID.randomUUID().toString();

    private static Metadata meta(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return Metadata.from(m);
    }

    private Metadata company(String source) {
        return meta("orgId", org, "scope", "COMPANY", "source", source);
    }

    private static final Metadata GUIDE = meta("orgId", "GLOBAL", "scope", "GLOBAL", "source", "GUIDE");

    // ── Không có người hỏi (việc chạy theo hệ thống) ────────────────────────────────────────────────

    @Test
    @DisplayName("HELP: có tổ chức → tài liệu chung + tài liệu CÔNG TY của tổ chức đó; không có → chỉ tài liệu chung")
    void helpSeesGlobalPlusOwnCompany() {
        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.HELP, org);
        assertThat(f.test(GUIDE)).isTrue();
        assertThat(f.test(company("REGULATION"))).isTrue();
        assertThat(f.test(meta("orgId", otherOrg, "scope", "COMPANY", "source", "REGULATION"))).isFalse();

        Filter anonymous = DocumentRetrieverFactory.filterFor(RetrievalProfile.HELP, null);
        assertThat(anonymous.test(GUIDE)).isTrue();
        assertThat(anonymous.test(company("REGULATION"))).isFalse();
    }

    @Test
    @DisplayName("KPI_CONTEXT / SUBMISSION_REVIEW: CHỈ tổ chức đó (không tài liệu chung) và đúng loại tài liệu")
    void orgOnlyProfilesFilterOrgAndSources() {
        Filter kpi = DocumentRetrieverFactory.filterFor(RetrievalProfile.KPI_CONTEXT, org);
        assertThat(kpi.test(company("JOB_DESCRIPTION"))).isTrue();
        assertThat(kpi.test(company("STRATEGY"))).isTrue();
        assertThat(kpi.test(company("REGULATION"))).isFalse();
        assertThat(kpi.test(GUIDE)).isFalse();

        Filter review = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org);
        assertThat(review.test(company("REGULATION"))).isTrue();
        assertThat(review.test(company("JOB_DESCRIPTION"))).isTrue();
        assertThat(review.test(company("STRATEGY"))).isFalse();
    }

    @Test
    @DisplayName("không có người hỏi: KHÔNG bao giờ đọc tài liệu đơn vị, cá nhân, hay đoạn thiếu scope")
    void systemReadsCompanyOnly() {
        for (RetrievalProfile p : RetrievalProfile.values()) {
            Filter f = DocumentRetrieverFactory.filterFor(p, org);
            assertThat(f.test(meta("orgId", org, "scope", "UNIT", "unitId", UUID.randomUUID().toString(), "source", "REGULATION")))
                    .as(p + " đọc tài liệu đơn vị").isFalse();
            assertThat(f.test(meta("orgId", org, "scope", "PERSONAL", "ownerId", UUID.randomUUID().toString(), "source", "REGULATION")))
                    .as(p + " đọc tài liệu cá nhân").isFalse();
            assertThat(f.test(meta("orgId", org, "source", "REGULATION"))).as(p + " đọc đoạn thiếu scope").isFalse();
            assertThat(f.test(meta("orgId", "GLOBAL", "source", "GUIDE"))).as(p + " đọc hướng dẫn thiếu scope").isFalse();
        }
    }

    @Test
    @DisplayName("chấm bài: CHỈ tài liệu trong danh sách cho phép; rỗng → không đọc gì; null → như không giới hạn")
    void onlyAllowedDocuments() {
        String mine = UUID.randomUUID().toString();
        String other = UUID.randomUUID().toString();

        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org, List.of(mine));
        assertThat(f.test(meta("orgId", org, "scope", "COMPANY", "source", "REGULATION", "docId", mine))).isTrue();
        assertThat(f.test(meta("orgId", org, "scope", "COMPANY", "source", "REGULATION", "docId", other))).isFalse();
        // Chốt chặn tổ chức vẫn còn: đúng docId nhưng tổ chức khác thì không lọt.
        assertThat(f.test(meta("orgId", otherOrg, "scope", "COMPANY", "source", "REGULATION", "docId", mine))).isFalse();

        Filter none = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org, List.of());
        assertThat(none.test(meta("orgId", org, "scope", "COMPANY", "source", "REGULATION", "docId", mine))).isFalse();

        assertThat(DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org, null))
                .isEqualTo(DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, org));
    }

    @Test
    @DisplayName("không biết tổ chức → KHÔNG đọc gì (an toàn hơn đọc tất cả)")
    void unknownOrgReadsNothing() {
        Filter f = DocumentRetrieverFactory.filterFor(RetrievalProfile.SUBMISSION_REVIEW, null);
        assertThat(f.test(company("REGULATION"))).isFalse();
        assertThat(f.test(GUIDE)).isFalse();
    }

    // ── Có người hỏi: đọc theo quyền của người đó ───────────────────────────────────────────────────

    @Test
    @DisplayName("có người hỏi: tài liệu cá nhân CỦA MÌNH, đơn vị mình được xem, công ty; không phải của người khác")
    @SuppressWarnings("unchecked")
    void userReadsByAccess() {
        UUID orgId = UUID.fromString(org);
        UUID me = UUID.randomUUID();
        UUID myUnit = UUID.randomUUID();
        DocumentAccessResolver resolver = mock(DocumentAccessResolver.class);
        when(resolver.resolve(me, orgId)).thenReturn(
                new DocumentAccess(orgId, me, true, Set.of(myUnit), Set.of(), Set.of(myUnit), false, true));
        DocumentRetrieverFactory factory = new DocumentRetrieverFactory(
                mock(EmbeddingStore.class), mock(EmbeddingModel.class), resolver);

        Filter help = factory.filterFor(RetrievalProfile.HELP, org, me.toString(), null);
        assertThat(help.test(GUIDE)).isTrue();
        assertThat(help.test(company("REGULATION"))).isTrue();
        assertThat(help.test(meta("orgId", org, "scope", "PERSONAL", "ownerId", me.toString()))).isTrue();
        assertThat(help.test(meta("orgId", org, "scope", "UNIT", "unitId", myUnit.toString()))).isTrue();
        assertThat(help.test(meta("orgId", org, "scope", "PERSONAL", "ownerId", UUID.randomUUID().toString()))).isFalse();
        assertThat(help.test(meta("orgId", org, "scope", "UNIT", "unitId", UUID.randomUUID().toString()))).isFalse();
        assertThat(help.test(meta("orgId", org))).isFalse();

        // Hồ sơ có lọc loại tài liệu vẫn lọc: gợi ý KPI không đọc quy chế, kể cả quy chế của đơn vị mình.
        Filter kpi = factory.filterFor(RetrievalProfile.KPI_CONTEXT, org, me.toString(), null);
        assertThat(kpi.test(meta("orgId", org, "scope", "UNIT", "unitId", myUnit.toString(), "source", "JOB_DESCRIPTION"))).isTrue();
        assertThat(kpi.test(meta("orgId", org, "scope", "UNIT", "unitId", myUnit.toString(), "source", "REGULATION"))).isFalse();
        assertThat(kpi.test(GUIDE)).isFalse();

        // Người hỏi không thuộc tổ chức này: resolver trả quyền rỗng → chỉ tài liệu chung (HELP) / không gì.
        UUID stranger = UUID.randomUUID();
        when(resolver.resolve(stranger, orgId)).thenReturn(DocumentAccess.none(orgId, stranger));
        Filter strangerHelp = factory.filterFor(RetrievalProfile.HELP, org, stranger.toString(), null);
        assertThat(strangerHelp.test(GUIDE)).isTrue();
        assertThat(strangerHelp.test(company("REGULATION"))).isFalse();
    }
}
