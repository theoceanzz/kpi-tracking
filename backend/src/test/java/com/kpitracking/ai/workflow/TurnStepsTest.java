package com.kpitracking.ai.workflow;

import com.kpitracking.ai.agent.PlannerAgent;
import com.kpitracking.ai.agent.RouterAgent;
import com.kpitracking.ai.memory.ConversationMemoryStore;
import com.kpitracking.ai.memory.TurnChatMemory;
import com.kpitracking.ai.memory.TurnRegistry;
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
import dev.langchain4j.invocation.InvocationParameters;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
    private PlannerAgent planner;
    private ToolRegistry registry;
    private TurnSteps steps;
    private TurnRegistry turns;

    private final Map<String, Object> scopeState = new HashMap<>();
    private final Map<String, Object> executionContext = new HashMap<>();
    private AgenticScope scope;
    private AiTurn turn;

    @BeforeEach
    void setUp() {
        router = mock(RouterAgent.class);
        planner = mock(PlannerAgent.class);
        registry = mock(ToolRegistry.class);
        when(registry.readGroups()).thenReturn(Set.of(Group.CORE, Group.LOOKUP, Group.KPI, Group.INSIGHT, Group.BSC, Group.OKR));
        when(registry.deniedGroups(any(), any())).thenReturn(Set.of());

        turns = new TurnRegistry();
        steps = new TurnSteps(mock(OrgUnitRepository.class), mock(FollowupContextStore.class),
                mock(ConversationMemoryStore.class), turns, registry,
                router, planner,
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
        when(scope.memoryId()).thenReturn("scope-1");
        doAnswer(inv -> { executionContext.put(inv.<Class<?>>getArgument(0).getName(), inv.getArgument(1)); return null; })
                .when(scope).writeExecutionContext(any(Class.class), any());
    }

    @Nested
    @DisplayName("lượt của nhân viên")
    class Staff {

        @Test
        @DisplayName("nhân viên -> chỉ nhóm PERSONAL, router chỉ để nhận HELP, không ACTION dù router bảo gì")
        void staffGetsPersonalGroupOnly() {
            turn.setStaff(true);
            when(router.route(any(), any())).thenReturn("ACTION,KPI,INSIGHT");

            steps.route(scope, List.of(handler("HELP", "HELP - hỏi cách dùng")));

            assertThat(turn.getToolGroups()).containsExactly(Group.PERSONAL);
            assertThat(scopeState.get(TurnSteps.INTENT)).isNull();
        }

        @Test
        @DisplayName("nhân viên hỏi cách dùng -> vẫn vào nhánh HELP")
        void staffCanStillAskHelp() {
            turn.setStaff(true);
            when(router.route(any(), any())).thenReturn("HELP");

            steps.route(scope, List.of(handler("HELP", "HELP - hỏi cách dùng")));

            assertThat(scopeState.get(TurnSteps.INTENT)).isEqualTo("HELP");
        }

        @Test
        @DisplayName("nhân viên -> KHÔNG lập kế hoạch (planner chỉ biết tool của quản lý, kế hoạch đó đẩy model lặp tool cá nhân)")
        void staffTurnIsNeverPlanned() {
            turn.setStaff(true);
            steps.planningEnabled = true;
            when(planner.plan(any())).thenReturn("1. get_people — danh sách; 2. rank — xếp hạng");

            steps.plan(scope);

            assertThat(turn.getPlan()).isNull();
            verify(planner, never()).plan(any());
        }

        @Test
        @DisplayName("model xin nới tool -> nhân viên KHÔNG được nới sang nhóm đọc của quản lý")
        void staffIsNeverWidened() {
            turn.setStaff(true);
            turn.setToolGroups(Set.of(Group.PERSONAL));
            turn.getAgentState().setWidenTools(true);

            steps.prepareRound(scope);

            assertThat(turn.getToolGroups()).containsExactly(Group.PERSONAL);
        }
    }

    @Nested
    @DisplayName("context")
    class Context {

        @Test
        @DisplayName("nối với mô-đun agentic: turnId = memoryId của scope, câu hỏi vào state, ngữ cảnh tool làm execution context")
        void wiresScopeForTheAgent() {
            steps.context(scope);

            assertThat(turn.getTurnId()).isEqualTo("scope-1");
            assertThat(scopeState.get(TurnSteps.QUESTION)).isEqualTo("Phòng IT có bao nhiêu người?");
            assertThat(turns.turn("scope-1")).isSameAs(turn);
            assertThat(turns.get("scope-1")).isSameAs(turn.getMemory());

            Object params = executionContext.get(InvocationParameters.class.getName());
            assertThat(params).isInstanceOf(InvocationParameters.class);
            InvocationParameters p = (InvocationParameters) params;
            assertThat(p.<Object>get("orgUnitId")).isEqualTo(turn.getManager().orgUnitId());
            assertThat(p.<Object>get(AgentState.CONTEXT_KEY)).isSameAs(turn.getAgentState());
        }

        @Test
        @DisplayName("release gỡ lượt khỏi sổ — khoá cũ nhận bộ nhớ rỗng, không nhận nhầm")
        void releaseUnregisters() {
            steps.context(scope);
            steps.release(turn);

            assertThat(turns.get("scope-1")).isNotSameAs(turn.getMemory());
            assertThat(turns.get("scope-1").messages()).isEmpty();
        }
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
        @DisplayName("nhãn nhánh chứa tên nhóm (vd EXPORT_KPI) -> vẫn là nhánh, KHÔNG rơi vào nhóm KPI")
        void intentLabelContainingGroupNameDoesNotLeakIntoGroup() {
            when(router.route(any(), any())).thenReturn("EXPORT_KPI");

            steps.route(scope, List.of(handler("EXPORT_KPI", "EXPORT_KPI - xuất báo cáo")));

            assertThat(scopeState.get(TurnSteps.INTENT)).isEqualTo("EXPORT_KPI");
            assertThat(turn.getToolGroups()).isNull();
        }

        @Test
        @DisplayName("router trả KPI thường -> không nhầm sang nhánh có nhãn chứa KPI")
        void plainKpiGroupIsNotAnIntent() {
            when(router.route(any(), any())).thenReturn("KPI");

            steps.route(scope, List.of(handler("EXPORT_KPI", "EXPORT_KPI - xuất báo cáo")));

            assertThat(scopeState.get(TurnSteps.INTENT)).isNull();
            assertThat(turn.getToolGroups()).contains(Group.KPI);
        }

        @Test
        @DisplayName("có ý định của handler -> validate bỏ qua (câu trả lời có số của nhánh không bị chặn)")
        void validateSkipsIntentBranches() {
            scopeState.put(TurnSteps.INTENT, "HELP");
            turn.getAgentState().setAnswer("Xem Hình 23, bước 3 trong hướng dẫn");

            steps.validate(scope);

            assertThat(turn.getAgentState().getAnswer()).isEqualTo("Xem Hình 23, bước 3 trong hướng dẫn");
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
            scopeState.put(TurnSteps.ANSWER, "nháp");
            turn.getMemory().add(UserMessage.from("x"));

            assertThat(steps.needsAnotherRound(scope)).isTrue();
            assertThat(turn.getMissingPlannedTools()).containsExactly("get_kpi");
            assertThat(state().getAnswer()).isNull();
            assertThat(scopeState.get(TurnSteps.ANSWER)).isNull();
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
            scopeState.put(TurnSteps.ANSWER, "xong");
            turn.getMemory().add(UserMessage.from("x"));

            assertThat(steps.needsAnotherRound(scope)).isFalse();
            assertThat(state().getAnswer()).isEqualTo("xong");
            assertThat(turn.getMemory().messages()).hasSize(1);
        }
    }
}
