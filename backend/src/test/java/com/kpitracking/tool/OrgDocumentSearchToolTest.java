package com.kpitracking.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.AiTurn;
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
import dev.langchain4j.store.embedding.filter.comparison.IsEqualTo;
import dev.langchain4j.store.embedding.filter.comparison.IsIn;
import dev.langchain4j.store.embedding.filter.logical.And;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@code get_org_documents}: lọc BẮT BUỘC theo tổ chức của lượt và chỉ hai loại tài liệu; rỗng thì
 * nói rõ để model dựa vào số liệu KPI thay vì im lặng.
 */
class OrgDocumentSearchToolTest {

    private EmbeddingStore<TextSegment> store;
    private OrgDocumentSearchTool tool;
    private final UUID orgId = UUID.randomUUID();

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
        tool = new OrgDocumentSearchTool(support, store, embeddingModel, 4);
    }

    private InvocationParameters ctx() {
        AiTurn turn = new AiTurn("q", null, null);
        AgentState st = new AgentState(turn);
        return new InvocationParameters(Map.of(
                "orgUnitId", UUID.randomUUID().toString(), "organizationId", orgId.toString(),
                "orgUnitPath", "/cty/", "userId", UUID.randomUUID(), "conversationId", "conv-1", AgentState.CONTEXT_KEY, st));
    }

    @Test
    @DisplayName("bộ lọc = orgId của lượt AND source IN (JOB_DESCRIPTION, STRATEGY); kết quả gọn: tài liệu, mục, đoạn")
    void filtersByOrgAndSourceAndCompactsHits() {
        TextSegment seg = TextSegment.from("Phòng IT chịu trách nhiệm uptime hệ thống 99,5 %",
                Metadata.from(Map.of("docTitle", "Mô tả công việc Phòng IT", "parent", "2. Nhiệm vụ", "title", "2.1 Vận hành",
                        "orgId", orgId.toString(), "source", "JOB_DESCRIPTION")));
        when(store.search(any())).thenReturn(new EmbeddingSearchResult<>(List.of(new EmbeddingMatch<>(0.03, "id-1", null, seg))));

        String out = tool.searchOrgDocuments(new OrgDocumentSearchRequest("nhiệm vụ và mục tiêu của Phòng IT"), ctx());

        assertThat(out).contains("\"count\":1").contains("Mô tả công việc Phòng IT").contains("2. Nhiệm vụ › 2.1 Vận hành")
                .contains("uptime");
        ArgumentCaptor<EmbeddingSearchRequest> req = ArgumentCaptor.forClass(EmbeddingSearchRequest.class);
        verify(store).search(req.capture());
        assertThat(req.getValue().maxResults()).isEqualTo(4);
        assertThat(req.getValue().filter()).isInstanceOf(And.class);
        And and = (And) req.getValue().filter();
        assertThat(and.left()).isInstanceOf(IsEqualTo.class);
        assertThat(((IsEqualTo) and.left()).comparisonValue()).isEqualTo(orgId.toString());
        assertThat(and.right()).isInstanceOf(IsIn.class);
        assertThat(((IsIn) and.right()).comparisonValues()).map(Object::toString).containsExactlyInAnyOrder("JOB_DESCRIPTION", "STRATEGY");
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
