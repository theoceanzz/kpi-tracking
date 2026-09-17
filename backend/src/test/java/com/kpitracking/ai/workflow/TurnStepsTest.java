package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.AssistantAgent;
import com.kpitracking.ai.agent.PlannerAgent;
import com.kpitracking.ai.agent.RouterAgent;
import com.kpitracking.ai.memory.ConversationMemoryStore;
import com.kpitracking.ai.memory.TurnChatMemory;
import com.kpitracking.ai.memory.TurnMemoryRegistry;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.FollowupService;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.tool.FollowupContextStore;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.tool.ToolRegistry.Group;
import dev.langchain4j.agentic.scope.AgenticScope;
import dev.langchain4j.data.message.UserMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Test cho các bước code thuần của workflow — phần quyết định "đi đâu tiếp" giữa các agent.
 *
 * <p>Hai bước được chốt kỹ nhất vì chúng là chỗ đồ thị cũ từng sai và đã vá:
 * <ul>
 *   <li>{@code route}: router lùi về đâu khi model trả lạ (KHÔNG BAO GIỜ là ACTION), nhận ra nhánh
 *       của {@code IntentHandler}, và hợp thêm nhóm từ kế hoạch;</li>
 *   <li>{@code needsAnotherRound}: thứ tự ưu tiên các cạnh quay lui, mỗi cạnh chỉ dùng MỘT lần,
 *       và có đề xuất/lời mời thì dừng ngay.</li>
 * </ul>
 */
class TurnStepsTest {

    private RouterAgent router;
    private ToolRegistry registry;
    private TurnSteps steps;

    private final Map<String, Object> scopeState = new HashMap<>();
    private AgenticScope scope;
    private AiTurn turn;

    @BeforeEach
    void setUp() {
        router = mock(RouterAgent.class);
        registry = mock(ToolRegistry.class);
        when(registry.readGroups()).thenReturn(Set.of(Group.CORE, Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR));
        when(registry.deniedGroups(any(), any())).thenReturn(Set.of());

        steps = new TurnSteps(mock(OrgUnitRepository.class), mock(FollowupContextStore.class),
                mock(ConversationMemoryStore.class), mock(TurnMemoryRegistry.class), registry,
                router, mock(PlannerAgent.class), mock(AssistantAgent.class),
                mock(FollowupService.class), new AnswerValidator(true));
        steps.routingEnabled = true;
        steps.planEnforce = true;

        turn = new AiTurn("Phòng IT có bao nhiêu người?", null, null);
        turn.setManager(new ManagerContext(UUID.randomUUID(), "/cty/it/", UUID.randomUUID(), "a@b.c", UUID.randomUUID()));
        turn.setAgentState(new AgentState(turn));
        turn.setMemory(new TurnChatMemory(turn.getTurnId(), List.of()));

        scope = mock(AgenticScope.class);
        scopeState.put(TurnSteps.TURN, turn);
        when(scope.readState(anyString())).thenAnswer(inv -> scopeState.get(inv.<String>getArgument(0)));
        doAnswer(inv -> { scopeState.put(inv.getArgument(0), inv.getArgument(1)); return null; })
                .when(scope).writeState(anyString(), any());
    }

    private static IntentHandler handler(String intent, String hint) {
        return new IntentHandler() {
            @Override public String intent() { return intent; }
            @Override public String routerHint() { return hint; }
            @Override public Consumer<AgenticScope> step() { return s -> { }; }
        };
    }

    @Nested
    @DisplayName("route")
    class Route {

        @Test
        @DisplayName("router trả nhóm -> nhóm đó; CORE luôn được hợp thêm ở ToolRegistry")
        void picksGroupsFromRouter() {
            when(router.route(any(), any())).thenReturn("LOOKUP, KPI");

            steps.route(scope, List.of());

            assertThat(turn.getToolGroups()).containsExactlyInAnyOrder(Group.LOOKUP, Group.KPI);
            assertThat(scopeState.get(TurnSteps.INTENT)).isNull();
        }

        @Test
        @DisplayName("router trả lạ -> lùi về nhóm ĐỌC, không bao giờ có ACTION")
        void unknownFallsBackToReadGroupsNeverAction() {
            when(router.route(any(), any())).thenReturn("tôi không chắc");

            steps.route(scope, List.of());

            assertThat(turn.getToolGroups()).contains(Group.LOOKUP, Group.KPI, Group.INSIGHT)
                    .doesNotContain(Group.ACTION);
        }

        @Test
        @DisplayName("router lỗi -> lùi về nhóm ĐỌC, lượt vẫn chạy")
        void routerFailureFallsBack() {
            when(router.route(any(), any())).thenThrow(new RuntimeException("timeout"));

            steps.route(scope, List.of());

            assertThat(turn.getToolGroups()).contains(Group.LOOKUP).doesNotContain(Group.ACTION);
        }

        @Test
        @DisplayName("router trả tên nhánh của IntentHandler -> ghi ý định, KHÔNG chọn nhóm tool")
        void recognizesIntentHandler() {
            when(router.route(any(), any())).thenReturn("HELP");

            steps.route(scope, List.of(handler("HELP", "HELP - hỏi cách dùng")));

            assertThat(scopeState.get(TurnSteps.INTENT)).isEqualTo("HELP");
            assertThat(turn.getToolGroups()).isNull();
        }

        @Test
        @DisplayName("handler không có gợi ý (tắt ở lượt này) thì router không chọn được nó")
        void disabledHandlerIsIgnored() {
            when(router.route(any(), any())).thenReturn("HELP");

            steps.route(scope, List.of(handler("HELP", null)));

            assertThat(scopeState.get(TurnSteps.INTENT)).isNull();
        }

        @Test
        @DisplayName("kế hoạch nêu tool ở nhóm khác -> nhóm đó được hợp thêm")
        void planWidensGroups() {
            when(router.route(any(), any())).thenReturn("LOOKUP");
            turn.setPlan(List.of(new PlanStep("get_people", "đếm"), new PlanStep("rank", "xếp hạng")));

            steps.route(scope, List.of());

            assertThat(turn.getToolGroups()).containsExactlyInAnyOrder(Group.LOOKUP, Group.INSIGHT);
        }

        @Test
        @DisplayName("tắt định tuyến -> mở toàn bộ nhóm đọc, không gọi router")
        void routingDisabledOpensAllReadGroups() {
            steps.routingEnabled = false;

            steps.route(scope, List.of());

            assertThat(turn.getToolGroups()).contains(Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR);
        }
    }

    @Nested
    @DisplayName("needsAnotherRound")
    class AnotherRound {

        private AgentState state() { return turn.getAgentState(); }

        @Test
        @DisplayName("kế hoạch có tool chưa chạy -> hỏi lại MỘT lần, ghi danh sách thiếu, xoá đệm")
        void planGapTriggersOneNudge() {
            turn.setPlan(List.of(new PlanStep("get_people", "a"), new PlanStep("get_kpi", "b")));
            state().recordSuccess("get_people");
            state().setAnswer("nháp");
            turn.getMemory().add(UserMessage.from("x"));

            assertThat(steps.needsAnotherRound(scope)).isTrue();
            assertThat(turn.getMissingPlannedTools()).containsExactly("get_kpi");
            assertThat(state().getAnswer()).isNull();
            assertThat(turn.getMemory().messages()).isEmpty();

            // Lần hai vẫn thiếu -> KHÔNG hỏi lại nữa; hỏi mãi là vòng lặp vô tận trả tiền token.
            assertThat(steps.needsAnotherRound(scope)).isFalse();
        }

        @Test
        @DisplayName("model xin thêm công cụ -> nới bộ tool, hỏi lại MỘT lần")
        void escapeHatchTriggersOneWiderRound() {
            state().setEscapeReason("cần BSC");

            assertThat(steps.needsAnotherRound(scope)).isTrue();
            assertThat(state().isWidenTools()).isTrue();
            assertThat(state().getEscapeReason()).isNull();

            state().setEscapeReason("lại xin nữa");
            assertThat(steps.needsAnotherRound(scope)).isFalse();
        }

        @Test
        @DisplayName("đã có đề xuất điền form -> DỪNG dù kế hoạch còn thiếu")
        void formPatchStopsEverything() {
            turn.setPlan(List.of(new PlanStep("get_people", "a"), new PlanStep("get_kpi", "b")));
            FormPatch patch = new FormPatch("kpi_form", List.of(new FormPatch.Entry("name", "Tên", "x", "x", "vì")));
            state().setFormPatch(patch);

            assertThat(steps.needsAnotherRound(scope)).isFalse();
        }

        @Test
        @DisplayName("hết ngân sách -> DỪNG")
        void budgetExhaustedStops() {
            state().setBudgetExhausted(true);
            state().setEscapeReason("x");

            assertThat(steps.needsAnotherRound(scope)).isFalse();
        }

        @Test
        @DisplayName("không có gì để bổ sung -> dừng, và không xoá gì")
        void nothingMissingStops() {
            state().setAnswer("xong");
            turn.getMemory().add(UserMessage.from("x"));

            assertThat(steps.needsAnotherRound(scope)).isFalse();
            assertThat(state().getAnswer()).isEqualTo("xong");
            assertThat(turn.getMemory().messages()).hasSize(1);
        }
    }
}
