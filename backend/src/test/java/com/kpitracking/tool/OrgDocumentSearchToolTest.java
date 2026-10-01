package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.document.retrieve.DocumentRetrieverFactory;
import com.kpitracking.ai.document.retrieve.DocumentSearchService;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.document.DocumentAccess;
import com.kpitracking.service.document.DocumentAccessResolver;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.OrgDocumentSearchRequest;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.request.EmbeddingRequest;
import dev.langchain4j.model.embedding.response.EmbeddingResponse;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.Filter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code get_org_documents}: hồ sơ KPI_CONTEXT (chỉ mô tả công việc + chiến lược), đọc theo QUYỀN của người hỏi
 * (bộ lọc fail-closed của {@link DocumentRetrieverFactory}); rỗng thì nói rõ để model dựa vào số liệu KPI; tài
 * liệu đã đọc thành chip nguồn của lượt.
 */
class OrgDocumentSearchToolTest {

    private EmbeddingStore<TextSegment> store;
    private OrgDocumentSearchTool tool;
    private DocumentAccessResolver resolver;
    private AgentState state;
    private final UUID orgId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID myUnit = UUID.randomUUID();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        store = mock(EmbeddingStore.class);
        EmbeddingModel embeddingModel = mock(EmbeddingModel.class);
        // Bộ truy hồi 1.20 gọi bản embed(EmbeddingRequest) (có inputType), không phải embed(String).
        when(embeddingModel.embed(any(EmbeddingRequest.class))).thenReturn(
                EmbeddingResponse.builder().embeddings(List.of(Embedding.from(new float[]{0.1f, 0.2f}))).build());
        ToolSupport support = new ToolSupport(mock(OrgUnitRepository.class), mock(UserRoleOrgUnitRepository.class),
                mock(UserRepository.class), mock(KpiCriteriaRepository.class), mock(ConversationMessageRepository.class),
                mock(OrgUnitStatisticService.class), mock(FollowupContextStore.class), new ObjectMapper());
        support.initToolMapper();
        resolver = mock(DocumentAccessResolver.class);
        when(resolver.resolve(userId, orgId)).thenReturn(
                new DocumentAccess(orgId, userId, true, Set.of(myUnit), Set.of(), Set.of(myUnit), false, true));
        tool = new OrgDocumentSearchTool(support, new DocumentRetrieverFactory(store, embeddingModel, resolver),
                new DocumentSearchService(), 4);
    }

    private InvocationParameters ctx() {
        AiTurn turn = new AiTurn("q", null, null);
        state = new AgentState(turn);
        return new InvocationParameters(Map.of(
                "orgUnitId", UUID.randomUUID().toString(), "organizationId", orgId.toString(),
                "orgUnitPath", "/cty/", "userId", userId, "conversationId", "conv-1", AgentState.CONTEXT_KEY, state));
    }

    private static Metadata meta(Object... kv) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return Metadata.from(m);
    }

    @Test
    @DisplayName("bộ lọc theo quyền người hỏi + chỉ JD/chiến lược; kết quả gọn; tài liệu đã đọc thành chip nguồn")
    void filtersByAccessAndSourceAndRecordsSources() {
        TextSegment seg = TextSegment.from("Phòng IT chịu trách nhiệm uptime hệ thống 99,5 %",
                meta("docTitle", "Mô tả công việc Phòng IT", "parent", "2. Nhiệm vụ", "title", "2.1 Vận hành",
                        "orgId", orgId.toString(), "scope", "COMPANY", "source", "JOB_DESCRIPTION",
                        "docId", "jd-it", "version", 1));
        when(store.search(any())).thenReturn(new EmbeddingSearchResult<>(List.of(new EmbeddingMatch<>(0.03, "id-1", null, seg))));

        String out = tool.searchOrgDocuments(new OrgDocumentSearchRequest("nhiệm vụ và mục tiêu của Phòng IT"), ctx());

        assertThat(out).contains("\"count\":1").contains("Mô tả công việc Phòng IT").contains("2. Nhiệm vụ › 2.1 Vận hành")
                .contains("uptime");
        ArgumentCaptor<EmbeddingSearchRequest> req = ArgumentCaptor.forClass(EmbeddingSearchRequest.class);
        verify(store).search(req.capture());
        assertThat(req.getValue().maxResults()).isEqualTo(4);
        verify(resolver).resolve(userId, orgId);

        Filter f = req.getValue().filter();
        String org = orgId.toString();
        // Lọt: JD công ty, chiến lược của đơn vị mình.
        assertThat(f.test(meta("orgId", org, "scope", "COMPANY", "source", "JOB_DESCRIPTION"))).isTrue();
        assertThat(f.test(meta("orgId", org, "scope", "UNIT", "unitId", myUnit.toString(), "source", "STRATEGY"))).isTrue();
        // Chặn: quy chế (không phải việc phải làm), JD của phòng khác, tài liệu cá nhân người khác, thiếu scope,
        // tổ chức khác, bộ hướng dẫn chung.
        assertThat(f.test(meta("orgId", org, "scope", "COMPANY", "source", "REGULATION"))).isFalse();
        assertThat(f.test(meta("orgId", org, "scope", "UNIT", "unitId", UUID.randomUUID().toString(), "source", "JOB_DESCRIPTION"))).isFalse();
        assertThat(f.test(meta("orgId", org, "scope", "PERSONAL", "ownerId", UUID.randomUUID().toString(), "source", "JOB_DESCRIPTION"))).isFalse();
        assertThat(f.test(meta("orgId", org, "source", "JOB_DESCRIPTION"))).isFalse();
        assertThat(f.test(meta("orgId", UUID.randomUUID().toString(), "scope", "COMPANY", "source", "JOB_DESCRIPTION"))).isFalse();
        assertThat(f.test(meta("orgId", "GLOBAL", "scope", "GLOBAL", "source", "JOB_DESCRIPTION"))).isFalse();

        assertThat(state.getSources()).singleElement().satisfies(src -> {
            assertThat(src.docId()).isEqualTo("jd-it");
            assertThat(src.title()).isEqualTo("Mô tả công việc Phòng IT");
            assertThat(src.section()).isEqualTo("2. Nhiệm vụ › 2.1 Vận hành");
        });
    }

    @Test
    @DisplayName("không có tài liệu -> count 0 kèm câu nói rõ để model dựa vào số liệu KPI")
    void emptyResultSaysSo() {
        when(store.search(any())).thenReturn(new EmbeddingSearchResult<>(List.of()));

        String out = tool.searchOrgDocuments(new OrgDocumentSearchRequest("mục tiêu của Phòng IT"), ctx());

        assertThat(out).contains("\"count\":0").contains("chưa tải mô tả công việc");
    }

    @Test
    @DisplayName("thiếu query -> lỗi có hướng dẫn, không gọi kho")
    void missingQueryIsAnError() {
        String out = tool.searchOrgDocuments(new OrgDocumentSearchRequest("  "), ctx());

        assertThat(out).contains("\"error\"").contains("query");
    }
}
