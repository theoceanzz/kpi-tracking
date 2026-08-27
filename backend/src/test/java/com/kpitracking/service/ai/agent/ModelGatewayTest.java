package com.kpitracking.service.ai.agent;

import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.ai.form.FormRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho lớp chuyển tiếp duy nhất tới Spring AI, và trọng tâm là <b>nhánh streaming vừa bật lại</b>.
 *
 * <p>Cờ {@code app.ai.streaming.enabled} đã từng bật, đo, rồi phải tắt: bộ 21 ca điền form tụt
 * 21/21 → 17/21. Bật lại lần này cần chứng minh ba điều, mỗi điều ứng với một lỗi CỤ THỂ của lần
 * trước:
 *
 * <ul>
 *   <li>các mẩu phải được GOM thành đúng một {@code ChatResponse} với đủ tool call — lần trước
 *       {@code OpenAiStreamFunctionCallingHelper} chỉ gộp được một tool call mỗi tin nhắn;</li>
 *   <li>token phải được ghi nhận — nhánh streaming cũ đi vòng qua advisor đo hạn mức, tức mọi lượt
 *       tiêu token mà không để lại dấu vết;</li>
 *   <li>{@code parallel_tool_calls} phải tắt KHI VÀ CHỈ KHI bật streaming, để đường không-streaming
 *       giữ đúng nền đã đo.</li>
 * </ul>
 */
class ModelGatewayTest {

    private OpenAiChatModel chatModel;
    private AiTokenUsageRecorder recorder;
    private ModelGateway gateway;

    private final Prompt prompt = new Prompt(List.of(new UserMessage("Phòng IT có mấy người?")),
            OpenAiChatOptions.builder().build());

    @BeforeEach
    void setUp() {
        chatModel = mock(OpenAiChatModel.class);
        recorder = mock(AiTokenUsageRecorder.class);
        gateway = new ModelGateway(chatModel, mock(ToolCallingManager.class), recorder);
    }

    /** Một mẩu của luồng: chỉ mang một phần văn bản. */
    private static ChatResponse chunk(String text) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private static ChatResponse toolCallChunk(String id, String name) {
        return new ChatResponse(List.of(new Generation(AssistantMessage.builder()
                .content("")
                .toolCalls(List.of(new AssistantMessage.ToolCall(id, "function", name, "{}")))
                .build())));
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cờ TẮT (mặc định)")
    class StreamingOff {

        @Test
        @DisplayName("gọi thẳng .call(), KHÔNG chạm tới .stream() dù có nơi nhận mẩu chữ")
        void usesCallEvenWhenSinkGiven() {
            gateway.streamingEnabled = false;
            when(chatModel.call(any(Prompt.class))).thenReturn(chunk("Phòng IT có 8 người."));
            List<String> emitted = new ArrayList<>();

            ChatResponse r = gateway.call(prompt, emitted::add);

            assertThat(r.getResult().getOutput().getText()).isEqualTo("Phòng IT có 8 người.");
            assertThat(emitted).as("tắt cờ thì không phát mẩu nào").isEmpty();
            verify(chatModel, never()).stream(any(Prompt.class));
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Cờ BẬT")
    class StreamingOn {

        @BeforeEach
        void on() {
            gateway.streamingEnabled = true;
        }

        @Test
        @DisplayName("gom các mẩu thành MỘT câu trả lời đầy đủ, và phát từng mẩu đúng thứ tự")
        void aggregatesChunksAndEmitsInOrder() {
            when(chatModel.stream(any(Prompt.class)))
                    .thenReturn(Flux.just(chunk("Phòng IT "), chunk("có "), chunk("8 người.")));
            List<String> emitted = new ArrayList<>();

            ChatResponse r = gateway.call(prompt, emitted::add);

            assertThat(emitted).containsExactly("Phòng IT ", "có ", "8 người.");
            assertThat(r.getResult().getOutput().getText())
                    .as("tầng trên phải nhận được TOÀN VĂN, không phải mẩu cuối")
                    .isEqualTo("Phòng IT có 8 người.");
        }

        @Test
        @DisplayName("lời gọi tool đi qua nguyên vẹn — đây là chỗ nhánh streaming cũ làm mất tool")
        void toolCallsSurviveAggregation() {
            when(chatModel.stream(any(Prompt.class)))
                    .thenReturn(Flux.just(toolCallChunk("c1", "get_people")));
            List<String> emitted = new ArrayList<>();

            ChatResponse r = gateway.call(prompt, emitted::add);

            assertThat(r.hasToolCalls()).isTrue();
            assertThat(r.getResult().getOutput().getToolCalls())
                    .extracting(AssistantMessage.ToolCall::name).containsExactly("get_people");
            assertThat(emitted).as("vòng gọi tool không sinh chữ nên không phát gì").isEmpty();
        }

        @Test
        @DisplayName("mẩu rỗng hoặc null không được phát — đừng bắn sự kiện SSE rỗng")
        void skipsEmptyChunks() {
            when(chatModel.stream(any(Prompt.class)))
                    .thenReturn(Flux.just(chunk(""), chunk("Xin chào"), chunk("")));
            List<String> emitted = new ArrayList<>();

            gateway.call(prompt, emitted::add);

            assertThat(emitted).containsExactly("Xin chào");
        }

        @Test
        @DisplayName("người nghe NÉM LỖI cũng không được làm hỏng lượt — client đóng tab là chuyện thường")
        void listenerFailureDoesNotBreakTheTurn() {
            when(chatModel.stream(any(Prompt.class)))
                    .thenReturn(Flux.just(chunk("một"), chunk(" hai")));

            ChatResponse r = gateway.call(prompt, t -> { throw new IllegalStateException("client đã ngắt"); });

            assertThat(r.getResult().getOutput().getText()).isEqualTo("một hai");
        }

        @Test
        @DisplayName("vẫn ghi tiêu thụ token — nhánh streaming cũ đi vòng qua toàn bộ hạn mức")
        void stillRecordsTokenUsage() {
            when(chatModel.stream(any(Prompt.class))).thenReturn(Flux.just(chunk("xong")));

            gateway.call(prompt, t -> { });

            // MessageAggregator gộp cả phần thống kê token vào bản tổng, nên chỗ ghi nhận là bản đó
            // chứ không phải từng mẩu — ghi theo mẩu sẽ đếm trùng gấp nhiều lần.
            verify(recorder, times(1)).record(any(), any());
        }

        @Test
        @DisplayName("không có nơi nhận mẩu chữ -> vẫn gọi thẳng, không mở luồng làm gì")
        void noSinkMeansPlainCall() {
            when(chatModel.call(any(Prompt.class))).thenReturn(chunk("xong"));

            gateway.call(prompt);

            verify(chatModel, never()).stream(any(Prompt.class));
        }
    }

    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("parallel_tool_calls theo cờ streaming")
    class ParallelToolCalls {

        private OpenAiChatOptions optionsWithStreaming(boolean streaming) {
            TurnPromptBuilder builder = new TurnPromptBuilder(null, mock(FormRegistry.class));
            builder.streamingEnabled = streaming;
            return (OpenAiChatOptions) builder.buildOptions(new com.kpitracking.service.ai.AiTurn(
                    "câu hỏi", null, null));
        }

        @Test
        @DisplayName("BẬT streaming -> tắt tool call song song")
        void offWhenStreaming() {
            // OpenAiStreamFunctionCallingHelper phân định tool call theo id và bỏ qua index, nên nó
            // không gộp nổi nhiều tool call song song: đo được câu ba vế chỉ gọi 1 tool ở nhánh
            // stream, còn nhánh call gọi đủ 3 — tất định 3/3 lần mỗi bên.
            assertThat(optionsWithStreaming(true).getParallelToolCalls()).isFalse();
        }

        @Test
        @DisplayName("TẮT streaming -> KHÔNG đụng vào, giữ đúng nền đã đo (42/43, 21/21)")
        void untouchedWhenNotStreaming() {
            // Đặt cứng false cho cả hai đường là âm thầm đổi hành vi của đường đang chạy tốt: model
            // buộc phải gọi tool tuần tự, tức nhiều vòng hơn cho cùng một câu hỏi.
            assertThat(optionsWithStreaming(false).getParallelToolCalls()).isNull();
        }

        @Test
        @DisplayName("cả hai đường đều KHÔNG để Spring AI tự chạy tool — vòng lặp là của ta")
        void internalToolExecutionAlwaysOff() {
            assertThat(optionsWithStreaming(true).getInternalToolExecutionEnabled()).isFalse();
            assertThat(optionsWithStreaming(false).getInternalToolExecutionEnabled()).isFalse();
        }
    }
}
