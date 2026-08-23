package com.kpitracking.service.ai.agent;

import com.kpitracking.service.ai.AiTurn;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.openai.OpenAiChatOptions;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho vòng lặp agent — phần vừa giành lại từ Spring AI.
 *
 * <p>Điều đáng chốt nhất ở đây là <b>ngân sách bước</b>. Chính vì bản trước KHÔNG điều khiển được
 * số vòng mà bộ 21 ca điền form tụt 21/21 → 17/21 khi bật streaming: model gọi tool với tham số
 * rỗng rồi cần 5–6 vòng để tự sửa, còn nhánh kia dừng ở ~3. Nay số vòng là tham số của ta, nên nó
 * phải có test chứ không phải một hằng số ai cũng có thể bóp xuống.
 */
class AgentLoopTest {

    private ModelGateway gateway;
    private AgentLoop loop;
    private AgentState state;
    private final ChatOptions options = OpenAiChatOptions.builder().build();
    private final List<Message> initial = List.of(new UserMessage("Phòng IT có bao nhiêu người?"));

    @BeforeEach
    void setUp() {
        gateway = mock(ModelGateway.class);
        loop = new AgentLoop(gateway);
        loop.maxSteps = 10;
        state = new AgentState(new AiTurn("Phòng IT có bao nhiêu người?", null, null));
    }

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

    @Test
    @DisplayName("model trả lời ngay -> đúng một vòng, không đụng tới tool")
    void answersWithoutTools() {
        when(gateway.call(any())).thenReturn(answering("Phòng IT có 8 người."));

        String answer = loop.run(state, initial, options);

        assertThat(answer).isEqualTo("Phòng IT có 8 người.");
        assertThat(state.getStep()).isEqualTo(1);
        assertThat(state.getRequested()).isEmpty();
        assertThat(state.isBudgetExhausted()).isFalse();
        verify(gateway, never()).executeToolCalls(any(), any());
    }

    @Test
    @DisplayName("gọi tool rồi mới trả lời -> hai vòng model, một lần chạy tool")
    void runsToolThenAnswers() {
        when(gateway.call(any()))
                .thenReturn(callingTool("c1", "get_people"))
                .thenReturn(answering("Phòng IT có 8 người."));
        when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

        String answer = loop.run(state, initial, options);

        assertThat(answer).isEqualTo("Phòng IT có 8 người.");
        assertThat(state.getRequested()).extracting(ToolCallRecord::name).containsExactly("get_people");
        verify(gateway, times(2)).call(any());
        verify(gateway, times(1)).executeToolCalls(any(), any());
    }

    @Test
    @DisplayName("ghi lại lời gọi tool NGAY KHI yêu cầu, kèm bước thứ mấy")
    void traceRecordsStepAndName() {
        when(gateway.call(any()))
                .thenReturn(callingTool("c1", "search"))
                .thenReturn(callingTool("c2", "get_kpi"))
                .thenReturn(answering("xong"));
        when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

        loop.run(state, initial, options);

        assertThat(state.getRequested())
                .extracting(ToolCallRecord::step, ToolCallRecord::name, ToolCallRecord::id)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(1, "search", "c1"),
                        org.assertj.core.groups.Tuple.tuple(2, "get_kpi", "c2"));
    }

    @Test
    @DisplayName("model gọi tool mãi không dứt -> dừng đúng ngân sách, bật cờ, KHÔNG ném ngoại lệ")
    void stopsAtBudgetWithoutThrowing() {
        loop.maxSteps = 3;
        when(gateway.call(any())).thenReturn(callingTool("c", "rank"));
        when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

        String answer = loop.run(state, initial, options);

        // Trả null chứ không ném: tầng trên còn ngữ cảnh trong tay và tự quyết định nói gì với
        // người dùng. Ném ở đây là biến một lượt dở dang thành câu xin lỗi chung chung.
        assertThat(answer).isNull();
        assertThat(state.isBudgetExhausted()).isTrue();
        verify(gateway, times(3)).call(any());
    }

    @Test
    @DisplayName("ngân sách mặc định phải RỘNG hơn số vòng model thường cần (5-6)")
    void defaultBudgetLeavesRoomForSelfCorrection() {
        // Đây là cái chốt thật sự của lớp test này. Bóp hằng số này xuống là tái lập đúng lỗi đã
        // làm bộ 21 ca điền form tụt 21/21 -> 17/21, và nó hỏng ÂM THẦM.
        assertThat(Integer.parseInt(AgentLoop.DEFAULT_MAX_STEPS)).isGreaterThanOrEqualTo(8);
    }

    @Test
    @DisplayName("tool khai returnDirect -> dừng luôn, không hỏi model thêm vòng nào")
    void returnDirectStopsTheLoop() {
        when(gateway.call(any())).thenReturn(callingTool("c1", "get_people"));
        when(gateway.executeToolCalls(any(), any())).thenReturn(executed(true));

        String answer = loop.run(state, initial, options);

        assertThat(answer).isEqualTo("lịch sử sau khi chạy tool");
        verify(gateway, times(1)).call(any());
    }

    @Test
    @DisplayName("lịch sử hội thoại sau mỗi vòng là thứ tool trả về, không phải bản chụp lúc đầu")
    void conversationHistoryIsReplacedByToolResult() {
        when(gateway.call(any()))
                .thenReturn(callingTool("c1", "get_people"))
                .thenReturn(answering("xong"));
        when(gateway.executeToolCalls(any(), any())).thenReturn(executed(false));

        loop.run(state, initial, options);

        // Đây chính là điều mà sáu ThreadLocal sinh ra để thay thế: kết quả tool giờ là GIÁ TRỊ
        // nằm trong state, đọc được mà không phụ thuộc luồng nào đang chạy.
        assertThat(state.getMessages()).hasSize(1);
        assertThat(state.getMessages().get(0).getText()).isEqualTo("lịch sử sau khi chạy tool");
    }

    @Test
    @DisplayName("model trả phản hồi rỗng -> answer null, không nổ")
    void nullResponseIsSafe() {
        when(gateway.call(any())).thenReturn(null);

        assertThat(loop.run(state, initial, options)).isNull();
        assertThat(state.isBudgetExhausted()).isFalse();
    }

    @Test
    @DisplayName("tuỳ chọn truyền vào được dùng nguyên vẹn cho lời gọi model")
    void passesOptionsThrough() {
        when(gateway.call(any())).thenReturn(answering("xong"));

        loop.run(state, initial, options);

        org.mockito.ArgumentCaptor<Prompt> captor = org.mockito.ArgumentCaptor.forClass(Prompt.class);
        verify(gateway).call(captor.capture());
        assertThat(captor.getValue().getOptions()).isSameAs(options);
    }
}
