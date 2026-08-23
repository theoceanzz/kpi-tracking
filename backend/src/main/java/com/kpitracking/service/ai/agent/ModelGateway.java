package com.kpitracking.service.ai.agent;

import com.kpitracking.service.AiTokenUsageRecorder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Component;

/**
 * Lớp chuyển tiếp DUY NHẤT tới Spring AI ở tầng thấp (Adapter).
 *
 * <p>Trước đây cả lượt gói trong một lời gọi {@code ChatClient.call()}, nghĩa là vòng lặp
 * {@code model → tool → model} thuộc về {@code DefaultToolCallingManager} chứ không thuộc về ứng
 * dụng. Hệ quả đã đo được: số vòng tự sửa lỗi khác nhau giữa {@code .call()} và {@code .stream()}
 * (5–6 so với ~3) làm bộ 21 ca điền form tụt 21/21 → 17/21, mà không có chỗ nào để chỉnh.
 *
 * <p>Ở đây ta tắt {@code internalToolExecutionEnabled} nên model trả về NGUYÊN lời gọi tool, còn
 * {@link #executeToolCalls} chạy chúng và trả lại lịch sử hội thoại. Kết quả tool trở thành GIÁ TRỊ
 * đọc được, thay cho việc phải móc ra bằng ThreadLocal.
 *
 * <p><b>Vì sao là một lớp riêng.</b> {@code ToolCallingManager} và {@code ToolExecutionResult} là
 * API 1.1.x. Gom vào một chỗ để nâng phiên bản Spring AI chỉ phải sửa đúng file này, thay vì mọi
 * node của vòng lặp.
 *
 * <p><b>Ghi token nằm ở đây, không nằm ở advisor.</b> Đường đi mới không qua {@code ChatClient} nên
 * {@code TokenUsageAuditAdvisor} không chạy. Bỏ sót chỗ này là mọi lượt tiêu token mà không để lại
 * dấu vết — tức đi vòng qua toàn bộ hạn mức, đúng lỗ hổng đã từng xảy ra ở nhánh streaming.
 * Bù lại ta ghi theo TỪNG vòng nên số liệu chi tiết hơn bản cũ (bản cũ chỉ ghi tổng cộng dồn).
 */
@Component
@Slf4j
public class ModelGateway {

    private final OpenAiChatModel chatModel;
    private final ToolCallingManager toolCallingManager;
    private final AiTokenUsageRecorder tokenUsageRecorder;

    public ModelGateway(OpenAiChatModel chatModel,
                        ToolCallingManager toolCallingManager,
                        AiTokenUsageRecorder tokenUsageRecorder) {
        this.chatModel = chatModel;
        this.toolCallingManager = toolCallingManager;
        this.tokenUsageRecorder = tokenUsageRecorder;
    }

    /** Một vòng gọi model. Ghi token ngay, kể cả khi vòng sau có hỏng. */
    public ChatResponse call(Prompt prompt) {
        ChatResponse response = chatModel.call(prompt);
        recordUsage(response);
        return response;
    }

    /** Chạy các tool model vừa yêu cầu; kết quả nằm trong {@code conversationHistory()}. */
    public ToolExecutionResult executeToolCalls(Prompt prompt, ChatResponse response) {
        return toolCallingManager.executeToolCalls(prompt, response);
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
