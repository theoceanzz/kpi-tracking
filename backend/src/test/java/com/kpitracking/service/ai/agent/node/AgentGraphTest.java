package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.form.FormPatch;
import com.kpitracking.service.ai.PlanStep;
import com.kpitracking.service.ai.agent.AgentGraph;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.ModelGateway;
import com.kpitracking.service.ai.agent.Node;
import com.kpitracking.service.ai.agent.ToolCallRecord;
import com.kpitracking.service.ai.agent.TurnPromptBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.openai.OpenAiChatOptions;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho đồ thị agent: vòng lặp gọi tool, và hai CẠNH QUAY LUI thay cho việc chạy lại cả chuỗi.
 *
 * <p>Hai nhóm khẳng định, và cả hai đều bảo vệ một lỗi đã xảy ra thật:
 *
 * <ul>
 *   <li><b>Ngân sách bước.</b> Chính vì bản trước KHÔNG điều khiển được số vòng mà bộ 21 ca điền
 *       form tụt 21/21 → 17/21 khi bật streaming: model gọi tool với tham số rỗng rồi cần 5–6 vòng
 *       để tự sửa, còn nhánh kia dừng ở ~3. Nay số vòng là tham số của ta, nên nó phải có test chứ
 *       không phải một hằng số ai cũng có thể bóp xuống.</li>
 *   <li><b>Mỗi cạnh quay lui đi ĐÚNG một lần.</b> Bản trước dựa vào việc mỗi công đoạn chỉ viết một
 *       câu {@code if}, và hệ quả là khi cửa thoát hiểm chạy lại cả chuỗi thì khâu bổ sung bước
 *       thiếu chạy LẠI lần nữa — trái với chính điều nó tự khai. Đồ thị có chu trình thì "đúng một
 *       lần" không còn là chuyện tự nhiên, nó là thứ phải chứng minh.</li>
 * </ul>
 *
 * <p>Lớp test nằm ở gói {@code agent.node} chứ không phải {@code agent}: cạnh chỉ kiểm được khi có
 * cả sáu đỉnh thật, và ngân sách bước là trường mức gói của {@link ModelNode}.
 */
class AgentGraphTest {

    private static final String QUESTION = "Phòng IT có bao nhiêu người?";

    private ModelGateway gateway;
    private TurnPromptBuilder promptBuilder;
    private ChatMemory chatMemory;

    private AiTurn turn;
    private AgentState state;

    private ModelNode modelNode;
    private ObserveNode observeNode;
    private StubNode plan;
    private StubNode route;

    private final ChatOptions options = OpenAiChatOptions.builder().build();
    private final List<Message> initial = List.of(new UserMessage(QUESTION));

    /**
     * Chụp lại giá trị {@code missingPlannedTools} tại đúng lúc mỗi lần hỏi dựng prompt.
     *
     * <p>Đọc sau khi đồ thị chạy xong thì luôn thấy null — {@code ObserveNode} dọn nó đi. Thứ cần
     * chứng minh là lần hỏi THỨ HAI nhìn thấy nó, còn lần thứ ba (nếu có) thì không.
     */
    private final List<List<String>> missingSeenPerAttempt = new ArrayList<>();

    /** Đỉnh giả cho PLAN và ROUTE: đếm số lần vào, và ghi lại cờ nới công cụ lúc đó. */
    private static final class StubNode implements Node {
        private final AgentNode id;
        private final AgentNode next;
        int entries;
        final List<Boolean> widenAtEntry = new ArrayList<>();

        StubNode(AgentNode id, AgentNode next) {
            this.id = id;
            this.next = next;
        }

        @Override public AgentNode id() { return id; }

        @Override public AgentNode run(AgentState state) {
            entries++;
            widenAtEntry.add(state.isWidenTools());
            return next;
        }
    }

    @BeforeEach
    void setUp() {
        gateway = mock(ModelGateway.class);
        promptBuilder = mock(TurnPromptBuilder.class);
        chatMemory = mock(ChatMemory.class);

        turn = new AiTurn(QUESTION, null, null);
        state = new AgentState(turn);

        when(promptBuilder.buildOptions(any())).thenReturn(options);
        when(promptBuilder.buildMessages(any())).thenAnswer(inv -> {
            missingSeenPerAttempt.add(turn.getMissingPlannedTools());
            return initial;
        });

        modelNode = new ModelNode(gateway, promptBuilder);
        modelNode.maxSteps = 10;
        observeNode = new ObserveNode(false);
        plan = new StubNode(AgentNode.PLAN, AgentNode.ROUTE);
        route = new StubNode(AgentNode.ROUTE, AgentNode.MODEL);
    }

    /** Đồ thị đủ sáu đỉnh, PLAN và ROUTE là đỉnh giả để không phải dựng router thật. */
    private AgentGraph graph() {
        return new AgentGraph(List.of(plan, route, modelNode, new ActNode(gateway),
                observeNode, new FinishNode(chatMemory)));
    }

    private String run() {
        return graph().run(state);
    }

    // ── dựng phản hồi của model ──────────────────────────────────────────────

    /** Câu trả lời thẳng, model không gọi tool nào. */
    private static ChatResponse answering(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    /** Model đòi gọi một tool. */
    private static ChatResponse callingTool(String id, String name) {
        AssistantMessage message = AssistantMessage.builder()
                .content("")
                .toolCalls(List.of(new AssistantMessage.ToolCall(id, "function", name, "{}")))
                .build();
        return new ChatResponse(List.of(new Generation(message)));
    }

    private static ToolExecutionResult executed(boolean returnDirect) {
        return ToolExecutionResult.builder()
                .conversationHistory(List.of(new UserMessage("lịch sử sau khi chạy tool")))
                .returnDirect(returnDirect)
                .build();
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Vòng lặp gọi tool")
    class Loop {

        @Test
        @DisplayName("model trả lời ngay -> đúng một vòng, không đụng tới tool")
        void answersWithoutTools() {
            when(gateway.call(any(), any())).thenReturn(answering("Phòng IT có 8 người."));

            assertThat(run()).isEqualTo("Phòng IT có 8 người.");
            assertThat(state.getStep()).isEqualTo(1);
            assertThat(state.getRequested()).isEmpty();
            assertThat(state.isBudgetExhausted()).isFalse();
            verify(gateway, never()).executeToolCalls(any(), any());
        }

        @Test
        @DisplayName("gọi tool rồi mới trả lời -> hai vòng model, một lần chạy tool")
        void runsToolThenAnswers() {
            when(gateway.call(any(), any()))
                    .thenReturn(callingTool("c1", "get_people"))
                    .thenReturn(answering("Phòng IT có 8 người."));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            assertThat(run()).isEqualTo("Phòng IT có 8 người.");
            assertThat(state.getRequested()).extracting(ToolCallRecord::name)
                    .containsExactly("get_people");
            verify(gateway, times(2)).call(any(), any());
            verify(gateway, times(1)).executeToolCalls(any(), any());
        }

        @Test
        @DisplayName("ghi lại lời gọi tool NGAY KHI yêu cầu, kèm bước thứ mấy")
        void traceRecordsStepAndName() {
            when(gateway.call(any(), any()))
                    .thenReturn(callingTool("c1", "search"))
                    .thenReturn(callingTool("c2", "get_kpi"))
                    .thenReturn(answering("xong"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            run();

            assertThat(state.getRequested())
                    .extracting(ToolCallRecord::step, ToolCallRecord::name, ToolCallRecord::id)
                    .containsExactly(
                            org.assertj.core.groups.Tuple.tuple(1, "search", "c1"),
                            org.assertj.core.groups.Tuple.tuple(2, "get_kpi", "c2"));
        }

        @Test
        @DisplayName("lịch sử hội thoại sau mỗi vòng là thứ tool trả về, không phải bản chụp lúc đầu")
        void conversationHistoryIsReplacedByToolResult() {
            when(gateway.call(any(), any()))
                    .thenReturn(callingTool("c1", "get_people"))
                    .thenReturn(answering("xong"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            run();

            // Đây chính là điều mà sáu ThreadLocal sinh ra để thay thế: kết quả tool giờ là GIÁ TRỊ
            // nằm trong state, đọc được mà không phụ thuộc luồng nào đang chạy.
            assertThat(state.getMessages()).hasSize(1);
            assertThat(state.getMessages().get(0).getText()).isEqualTo("lịch sử sau khi chạy tool");
        }

        @Test
        @DisplayName("tool khai returnDirect -> dừng luôn, không hỏi model thêm vòng nào")
        void returnDirectStopsTheLoop() {
            when(gateway.call(any(), any())).thenReturn(callingTool("c1", "get_people"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(true));

            assertThat(run()).isEqualTo("lịch sử sau khi chạy tool");
            verify(gateway, times(1)).call(any(), any());
        }

        @Test
        @DisplayName("tuỳ chọn dựng lại MỖI vòng, không giữ bản chụp — cửa thoát hiểm đổi bộ tool giữa lượt")
        void optionsAreRebuiltEveryRound() {
            when(gateway.call(any(), any()))
                    .thenReturn(callingTool("c1", "get_people"))
                    .thenReturn(answering("xong"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            run();

            org.mockito.ArgumentCaptor<Prompt> captor = org.mockito.ArgumentCaptor.forClass(Prompt.class);
            verify(gateway, times(2)).call(captor.capture(), any());
            assertThat(captor.getAllValues()).allSatisfy(
                    p -> assertThat(p.getOptions()).isSameAs(options));
            verify(promptBuilder, times(2)).buildOptions(any());
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Ngân sách bước")
    class Budget {

        @Test
        @DisplayName("model gọi tool mãi không dứt -> dừng đúng ngân sách và nói THẬT, không ném ngoại lệ")
        void stopsAtBudgetWithoutThrowing() {
            modelNode.maxSteps = 3;
            when(gateway.call(any(), any())).thenReturn(callingTool("c", "rank"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            String answer = run();

            // Không ném: tầng trên còn ngữ cảnh trong tay. Và câu trả lời phải nói ĐÚNG nguyên nhân —
            // nói sai thì người dùng đi sửa sai chỗ.
            assertThat(state.isBudgetExhausted()).isTrue();
            assertThat(answer).contains("quá nhiều bước tra cứu").contains("tách nhỏ câu hỏi");
            verify(gateway, times(3)).call(any(), any());
        }

        @Test
        @DisplayName("ngân sách mặc định phải RỘNG hơn số vòng model thường cần (5-6)")
        void defaultBudgetLeavesRoomForSelfCorrection() {
            // Đây là cái chốt thật sự. Bóp hằng số này xuống là tái lập đúng lỗi đã làm bộ 21 ca
            // điền form tụt 21/21 -> 17/21, và nó hỏng ÂM THẦM.
            assertThat(Integer.parseInt(ModelNode.DEFAULT_MAX_STEPS)).isGreaterThanOrEqualTo(8);
        }

        @Test
        @DisplayName("model trả phản hồi rỗng -> nói thật là không tạo được câu trả lời")
        void nullResponseIsSafe() {
            when(gateway.call(any(), any())).thenReturn(null);

            assertThat(run()).contains("nội dung xử lý quá dài");
            assertThat(state.isBudgetExhausted())
                    .as("rỗng vì model tiêu hết token cho phần suy luận, KHÁC hẳn chạy loạn hết ngân sách")
                    .isFalse();
        }

        @Test
        @DisplayName("hết ngân sách thì KHÔNG hỏi lại nữa — chính model đang không dừng được")
        void exhaustedBudgetSkipsRetryEdges() {
            modelNode.maxSteps = 2;
            observeNode = new ObserveNode(true);
            turn.setPlan(List.of(new PlanStep("get_kpi", "lấy KPI"),
                    new PlanStep("get_analytics", "xem xu hướng")));
            when(gateway.call(any(), any())).thenReturn(callingTool("c", "rank"));
            when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

            run();

            assertThat(state.isPlanNudgeUsed())
                    .as("hỏi lại khi model đang chạy loạn chỉ tốn thêm một lần gọi model")
                    .isFalse();
            verify(gateway, times(2)).call(any(), any());
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cạnh quay lui: bổ sung bước còn thiếu (thay PlanCompletionStage)")
    class PlanNudgeEdge {

        /** Kế hoạch hai bước; chỉ get_kpi chạy được, get_analytics bị bỏ. */
        private void planWithOneToolMissing() {
            turn.setPlan(List.of(new PlanStep("get_kpi", "lấy KPI"),
                    new PlanStep("get_analytics", "xem xu hướng")));
            state.recordSuccess("get_kpi");
        }

        @Test
        @DisplayName("TẮT công tắc -> không hỏi lại, dù kế hoạch còn thiếu")
        void disabledDoesNotRetry() {
            observeNode = new ObserveNode(false);
            planWithOneToolMissing();
            when(gateway.call(any(), any())).thenReturn(answering("trả lời thiếu vế"));

            assertThat(run()).isEqualTo("trả lời thiếu vế");
            verify(gateway, times(1)).call(any(), any());
        }

        @Test
        @DisplayName("thiếu bước -> hỏi lại MỘT lần, và lần đó prompt nêu đúng phần còn thiếu")
        void retriesOnceWithMissingToolsInPrompt() {
            observeNode = new ObserveNode(true);
            planWithOneToolMissing();
            when(gateway.call(any(), any()))
                    .thenReturn(answering("trả lời thiếu vế"))
                    .thenAnswer(inv -> {
                        state.recordSuccess("get_analytics");
                        return answering("trả lời đầy đủ");
                    });

            assertThat(run()).isEqualTo("trả lời đầy đủ");
            verify(gateway, times(2)).call(any(), any());
            assertThat(missingSeenPerAttempt)
                    .as("lần hỏi đầu không có khối CÒN THIẾU, lần hai có và chỉ nêu tool bị bỏ")
                    .containsExactly(null, List.of("get_analytics"));
        }

        @Test
        @DisplayName("hỏi lại rồi VẪN thiếu -> thôi, không hỏi lần ba")
        void retriesAtMostOnce() {
            observeNode = new ObserveNode(true);
            planWithOneToolMissing();
            when(gateway.call(any(), any())).thenReturn(answering("vẫn thiếu vế"));

            // Model đã phớt lờ hai lần thì lần ba cũng vậy, mà mỗi lần là một lần gọi model có thật
            // phải trả tiền.
            assertThat(run()).isEqualTo("vẫn thiếu vế");
            verify(gateway, times(2)).call(any(), any());
        }

        @Test
        @DisplayName("đã có đề xuất điền form -> DỪNG, dù kế hoạch còn thiếu bước")
        void formPatchEndsTheTurnEvenWithAnIncompletePlan() {
            // Đây là ca S01 thu nhỏ, và là nguồn gốc của việc nó chập chờn. PlanNode cố ý KHÔNG biết
            // tool điền form, nên với lượt điền form kế hoạch LUÔN nêu tool tra cứu chẳng liên quan
            // và phép đối chiếu LUÔN thấy "còn thiếu". Không có cạnh này thì model gọi đúng tool
            // ngay lần đầu vẫn bị bắt hỏi lại, lần hai vứt bản vá đúng đi rồi tung xúc xắc lần nữa.
            observeNode = new ObserveNode(true);
            planWithOneToolMissing();
            when(gateway.call(any(), any())).thenAnswer(inv -> {
                state.setFormPatch(new FormPatch("submission-form", List.of(
                        new FormPatch.Entry("actualValue", "Giá trị thực tế", 12, "12", "người dùng nêu"))));
                return answering("đã chuẩn bị đề xuất điền form");
            });

            assertThat(run()).isEqualTo("đã chuẩn bị đề xuất điền form");
            verify(gateway, times(1)).call(any(), any());
            assertThat(state.isPlanNudgeUsed())
                    .as("có bản vá trong tay là việc người dùng nhờ đã xong, kế hoạch nói gì cũng mặc")
                    .isFalse();
        }

        @Test
        @DisplayName("đề xuất RỖNG thì không tính là xong — vẫn hỏi lại nếu thiếu bước")
        void emptyFormPatchDoesNotCountAsDone() {
            // FormPatch rỗng nghĩa là tool chạy nhưng không đề xuất được ô nào; coi đó là "xong" thì
            // cạnh mới sẽ nuốt luôn cơ hội sửa của những lượt KHÔNG phải điền form.
            observeNode = new ObserveNode(true);
            planWithOneToolMissing();
            when(gateway.call(any(), any())).thenAnswer(inv -> {
                state.setFormPatch(new FormPatch("submission-form", List.of()));
                return answering("không đề xuất được gì");
            });

            run();
            assertThat(state.isPlanNudgeUsed()).isTrue();
            verify(gateway, times(2)).call(any(), any());
        }

        @Test
        @DisplayName("kế hoạch đủ bước -> không hỏi lại")
        void completePlanDoesNotRetry() {
            observeNode = new ObserveNode(true);
            turn.setPlan(List.of(new PlanStep("get_kpi", "lấy KPI")));
            state.recordSuccess("get_kpi");
            when(gateway.call(any(), any())).thenReturn(answering("đủ rồi"));

            assertThat(run()).isEqualTo("đủ rồi");
            verify(gateway, times(1)).call(any(), any());
        }

        @Test
        @DisplayName("bước KHÔNG nêu tool thì không có gì để đối chiếu, đừng hỏi lại vô ích")
        void stepsWithoutToolAreIgnored() {
            observeNode = new ObserveNode(true);
            turn.setPlan(List.of(new PlanStep(null, "làm gì đó không rõ tool")));
            when(gateway.call(any(), any())).thenReturn(answering("xong"));

            assertThat(run()).isEqualTo("xong");
            verify(gateway, times(1)).call(any(), any());
        }

        @Test
        @DisplayName("hỏi lại thì bắt đầu HỘI THOẠI MỚI, không nối vào câu trả lời hỏng của lượt đầu")
        void retryStartsFreshConversation() {
            observeNode = new ObserveNode(true);
            planWithOneToolMissing();
            when(gateway.call(any(), any())).thenReturn(answering("vẫn thiếu"));

            run();

            // Nối tiếp là bắt model đọc lại chính câu trả lời hỏng của nó. Bản trước phải gọi
            // ChatMemoryCleaner.dropLastExchange để dọn; nay hội thoại dựng lại từ đầu.
            verify(promptBuilder, times(2)).buildMessages(any());
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cạnh quay lui: nới bộ công cụ (thay EscapeHatchStage)")
    class EscapeEdge {

        @Test
        @DisplayName("model xin thêm tool -> quay về ROUTE với cờ nới, rồi hỏi lại")
        void widensToolsAndRetries() {
            when(gateway.call(any(), any()))
                    .thenAnswer(inv -> {
                        state.setEscapeReason("không có tool xem thẻ điểm");
                        return answering("mình chưa có công cụ cho việc này");
                    })
                    .thenReturn(answering("Điểm thẻ cân bằng là 82."));

            assertThat(run()).isEqualTo("Điểm thẻ cân bằng là 82.");
            assertThat(route.entries).as("phải đi LẠI qua ROUTE, không tự dựng danh sách tool bằng tay")
                    .isEqualTo(2);
            assertThat(route.widenAtEntry).containsExactly(false, true);
            assertThat(plan.entries).as("không lập lại kế hoạch — đó là một lần gọi model vô ích")
                    .isEqualTo(1);
        }

        @Test
        @DisplayName("xin lần hai -> thôi, chỉ nới ĐÚNG một lần")
        void widensAtMostOnce() {
            when(gateway.call(any(), any())).thenAnswer(inv -> {
                state.setEscapeReason("vẫn thiếu tool");
                return answering("vẫn chưa làm được");
            });

            assertThat(run()).isEqualTo("vẫn chưa làm được");
            verify(gateway, times(2)).call(any(), any());
            assertThat(route.entries).isEqualTo(2);
        }

        @Test
        @DisplayName("bổ sung bước thiếu chạy TRƯỚC nới công cụ, và khối CÒN THIẾU không rò sang lần nới")
        void planNudgeRunsBeforeEscapeAndDoesNotLeak() {
            // Thứ tự này giữ đúng bản trước: PlanCompletionStage(1050) là lớp TRONG của
            // EscapeHatchStage(1000) nên nó chạy trước. Và nếu khối "CÒN THIẾU" còn sót lại ở lần
            // hỏi thứ ba thì model nhận một kế hoạch rút gọn ngoài ý muốn.
            observeNode = new ObserveNode(true);
            turn.setPlan(List.of(new PlanStep("get_kpi", "lấy KPI"),
                    new PlanStep("get_analytics", "xem xu hướng")));
            state.recordSuccess("get_kpi");
            when(gateway.call(any(), any())).thenAnswer(inv -> {
                state.setEscapeReason("thiếu tool");
                return answering("chưa xong");
            });

            run();

            assertThat(missingSeenPerAttempt)
                    .containsExactly(null, List.of("get_analytics"), null);
            assertThat(state.isPlanNudgeUsed()).isTrue();
            assertThat(state.isEscapeUsed()).isTrue();
            verify(gateway, times(3)).call(any(), any());
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Bộ nhớ hội thoại")
    class Memory {

        private void withMemory() {
            turn = new AiTurn(QUESTION, "conv-1", null);
            state = new AgentState(turn);
        }

        @Test
        @DisplayName("ghi ĐÚNG MỘT lần, sau khi đã có câu trả lời — nên không sinh câu hỏi mồ côi")
        void writesOnceAfterAnswer() {
            withMemory();
            when(gateway.call(any(), any())).thenReturn(answering("Phòng IT có 8 người."));

            run();

            verify(chatMemory, times(1)).add(anyString(), any(List.class));
        }

        @Test
        @DisplayName("hỏi lại hai lần cũng chỉ ghi MỘT lần — không còn gì để dropLastExchange dọn")
        void retryDoesNotDirtyMemory() {
            withMemory();
            observeNode = new ObserveNode(true);
            turn.setPlan(List.of(new PlanStep("get_kpi", "lấy KPI")));
            when(gateway.call(any(), any())).thenReturn(answering("trả lời"));

            run();

            // Bản trước công đoạn gọi model ghi bộ nhớ NGAY khi có câu trả lời, nên khâu hỏi lại
            // phải đi xoá đúng cặp hỏi-đáp mà chính nó vừa làm bẩn.
            verify(gateway, times(2)).call(any(), any());
            verify(chatMemory, times(1)).add(anyString(), any(List.class));
        }

        @Test
        @DisplayName("không có câu trả lời -> KHÔNG ghi gì, câu xin lỗi đừng nằm lại trong hội thoại")
        void emptyAnswerIsNotRemembered() {
            withMemory();
            when(gateway.call(any(), any())).thenReturn(answering("   "));

            assertThat(run()).contains("nội dung xử lý quá dài");
            verify(chatMemory, never()).add(anyString(), any(List.class));
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cấu hình đồ thị")
    class Wiring {

        @Test
        @DisplayName("thiếu một đỉnh -> nổ lúc KHỞI ĐỘNG, không phải giữa lượt hỏi của người dùng thật")
        void missingNodeFailsAtStartup() {
            assertThatThrownBy(() -> new AgentGraph(List.of(plan, route, modelNode)))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("thiếu đỉnh");
        }

        @Test
        @DisplayName("hai bean cùng phụ trách một đỉnh -> nổ, không âm thầm chọn một cái")
        void duplicateNodeFailsAtStartup() {
            assertThatThrownBy(() -> new AgentGraph(List.of(plan, route, modelNode,
                    new ActNode(gateway), observeNode, new FinishNode(chatMemory),
                    new StubNode(AgentNode.MODEL, AgentNode.OBSERVE))))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("cùng phụ trách đỉnh MODEL");
        }

        @Test
        @DisplayName("một cạnh quay lui KHÔNG tự tắt -> đồ thị vẫn dừng và nói thật, không treo")
        void runawayCycleIsCapped() {
            // Đây là lưới chặn lỗi LẬP TRÌNH, không phải lỗi của model: một cạnh mới quên đặt cờ
            // "đã đi qua". Đồ thị có chu trình thì việc này phải có lưới, không thể chỉ trông vào
            // việc người viết node nhớ đặt cờ.
            Node buggyObserve = new Node() {
                @Override public AgentNode id() { return AgentNode.OBSERVE; }
                @Override public AgentNode run(AgentState s) {
                    s.resetConversation();   // đưa ngân sách bước về 0 mãi mãi
                    return AgentNode.MODEL;
                }
            };
            when(gateway.call(any(), any())).thenReturn(answering("xong"));

            AgentGraph g = new AgentGraph(List.of(plan, route, modelNode, new ActNode(gateway),
                    buggyObserve, new FinishNode(chatMemory)));

            assertThat(g.run(state)).contains("quá nhiều bước tra cứu");
        }
    }
}
