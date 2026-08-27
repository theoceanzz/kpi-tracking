package com.kpitracking.service.ai.agent;

import com.kpitracking.service.AiTokenUsageRecorder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.MessageAggregator;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * Lớp chuyển tiếp DUY NHẤT tới Spring AI ở tầng thấp (Adapter).
 *
 * <p>Trước đây cả lượt gói trong một lời gọi {@code ChatClient.call()}, nghĩa là vòng lặp
 * {@code model → tool → model} thuộc về {@code DefaultToolCallingManager} chứ không thuộc về ứng
 * dụng. Ở đây ta tắt {@code internalToolExecutionEnabled} nên model trả về NGUYÊN lời gọi tool, còn
 * {@link #executeToolCalls} chạy chúng và trả lại lịch sử hội thoại. Kết quả tool trở thành GIÁ TRỊ
 * đọc được, thay cho việc phải móc ra bằng ThreadLocal.
 *
 * <p><b>Vì sao là một lớp riêng.</b> {@code ToolCallingManager}, {@code ToolExecutionResult} và
 * {@code MessageAggregator} là API 1.1.x. Gom vào một chỗ để nâng phiên bản Spring AI chỉ phải sửa
 * đúng file này, thay vì mọi đỉnh của đồ thị.
 *
 * <p><b>Ghi token nằm ở đây, không nằm ở advisor.</b> Đường đi mới không qua {@code ChatClient} nên
 * {@code TokenUsageAuditAdvisor} không chạy. Bỏ sót chỗ này là mọi lượt tiêu token mà không để lại
 * dấu vết — tức đi vòng qua toàn bộ hạn mức, đúng lỗ hổng đã từng xảy ra ở nhánh streaming. Bù lại
 * ta ghi theo TỪNG vòng nên số liệu chi tiết hơn bản cũ (bản cũ chỉ ghi tổng cộng dồn).
 *
 * <h2>Nhánh streaming</h2>
 *
 * <p>Cờ {@code app.ai.streaming.enabled} đã từng bật, đo, rồi phải tắt lại: bộ 21 ca điền form tụt
 * 21/21 → 17/21. Nguyên nhân KHÔNG phải bản thân việc phát chữ, mà là <b>số vòng tự sửa lỗi</b>:
 * {@code .call()} cho model 5–6 vòng, {@code .stream()} chỉ ~3, và vòng lặp đó thuộc về thư viện nên
 * không có chỗ nào chỉnh. Nay vòng lặp là của ta ({@code ModelNode} + {@code ActNode}), số vòng do
 * {@code app.ai.agent.max-steps} quyết định và giống hệt nhau ở cả hai đường — nên nguyên nhân gốc
 * của lần hỏng ấy đã không còn.
 *
 * <p>Hai điều còn lại vẫn phải tự lo, và đều là lỗi có thật của lần trước:
 * <ul>
 *   <li><b>Gộp các mẩu.</b> {@code chatModel.stream()} phát từng mẩu; tầng trên cần MỘT
 *       {@code ChatResponse} đủ cả văn bản lẫn lời gọi tool. {@code MessageAggregator} làm đúng việc
 *       đó — nó cộng dồn văn bản và gom mọi tool call. An toàn vì {@code OpenAiApi} đã gộp cửa sổ
 *       mẩu của một lời gọi tool thành một chunk hoàn chỉnh trước khi tới đây.</li>
 *   <li><b>Tool call song song.</b> {@code OpenAiStreamFunctionCallingHelper} ném thẳng
 *       "Currently only one tool call is supported per message!", nên {@code parallel_tool_calls}
 *       phải tắt — việc đó làm ở {@code TurnPromptBuilder.buildOptions}, và CHỈ khi bật streaming.</li>
 * </ul>
 *
 * <p>Mẩu chữ phát ra là <b>bản xem trước</b>: nó chưa qua {@code ResponseSanitizingAdvisor}, và
 * client phải thay bằng nội dung của sự kiện {@code done}. Lọc theo mẩu thì một tên tool bị cắt đôi
 * qua hai mẩu sẽ lọt lưới, nên việc lọc ở lại đỉnh chốt của đồ thị, trên toàn văn.
 */
@Component
@Slf4j
public class ModelGateway {

    private final OpenAiChatModel chatModel;
    private final ToolCallingManager toolCallingManager;
    private final AiTokenUsageRecorder tokenUsageRecorder;

    @Value("${app.ai.streaming.enabled:false}")
    boolean streamingEnabled;

    public ModelGateway(OpenAiChatModel chatModel,
                        ToolCallingManager toolCallingManager,
                        AiTokenUsageRecorder tokenUsageRecorder) {
        this.chatModel = chatModel;
        this.toolCallingManager = toolCallingManager;
        this.tokenUsageRecorder = tokenUsageRecorder;
    }

    /** Một vòng gọi model, không phát chữ. Dùng cho đường không có ai nghe (JSON, gợi ý KPI). */
    public ChatResponse call(Prompt prompt) {
        return call(prompt, null);
    }

    /**
     * Một vòng gọi model. Ghi token ngay, kể cả khi vòng sau có hỏng.
     *
     * @param sink nơi nhận từng mẩu chữ, hoặc {@code null} nếu không ai nghe. Chỉ thực sự phát khi
     *             cờ streaming đang bật — tắt cờ thì đường đi giống từng bước với bản đã đo.
     */
    public ChatResponse call(Prompt prompt, Consumer<String> sink) {
        ChatResponse response = streamingEnabled && sink != null
                ? streamAndAggregate(prompt, sink)
                : chatModel.call(prompt);
        recordUsage(response);
        return response;
    }

    /**
     * Phát từng mẩu cho {@code sink}, đồng thời gom tất cả thành một phản hồi đầy đủ.
     *
     * <p>{@code blockLast()} là có chủ đích: vòng lặp agent đồng bộ, và đây là đúng chỗ nối hai thế
     * giới đó. Chuyển cả vòng lặp sang reactive là việc lớn hơn nhiều, mà chính nó từng làm bốn kho
     * ThreadLocal hỏng âm thầm vì tool chạy trên luồng khác.
     */
    private ChatResponse streamAndAggregate(Prompt prompt, Consumer<String> sink) {
        AtomicReference<ChatResponse> aggregated = new AtomicReference<>();
        new MessageAggregator()
                .aggregate(chatModel.stream(prompt), aggregated::set)
                .doOnNext(chunk -> emit(sink, textOf(chunk)))
                .blockLast();
        return aggregated.get();
    }

    /** Chạy các tool model vừa yêu cầu; kết quả nằm trong {@code conversationHistory()}. */
    public ToolExecutionResult executeToolCalls(Prompt prompt, ChatResponse response) {
        return toolCallingManager.executeToolCalls(prompt, response);
    }

    /**
     * Gửi một mẩu chữ đi, nuốt mọi lỗi.
     *
     * <p>Client đóng tab giữa chừng là chuyện thường, và lúc đó mọi lời gửi đều ném. Để lỗi đó nổi
     * lên là biến một lượt đang chạy tốt thành lượt hỏng — mà lượt vẫn phải chạy nốt để ghi cho đúng
     * mức tiêu thụ token.
     */
    private static void emit(Consumer<String> sink, String chunk) {
        if (chunk == null || chunk.isEmpty()) return;
        try {
            sink.accept(chunk);
        } catch (Exception e) {
            log.debug("Không phát được mẩu chữ ({}), bỏ qua", e.getMessage());
        }
    }

    private static String textOf(ChatResponse response) {
        if (response == null || response.getResult() == null
                || response.getResult().getOutput() == null) {
            return null;
        }
        return response.getResult().getOutput().getText();
    }

    /** Nuốt mọi lỗi: ghi nhận hỏng không được làm hỏng câu trả lời đã có cho người dùng. */
    private void recordUsage(ChatResponse response) {
        try {
            if (response == null || response.getMetadata() == null) return;
            Usage usage = response.getMetadata().getUsage();
            if (usage == null) return;
            log.info("Token usage details: {}", usage);
            tokenUsageRecorder.record(usage, response.getMetadata().getModel());
        } catch (Exception e) {
            log.error("Không ghi được tiêu thụ token: {}", e.getMessage(), e);
        }
    }
}
