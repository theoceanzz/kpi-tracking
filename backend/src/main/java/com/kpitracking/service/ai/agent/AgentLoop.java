package com.kpitracking.service.ai.agent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Vòng lặp agent, và lần này nó thuộc về ứng dụng.
 *
 * <pre>
 *   model  →  có gọi tool?  →  chạy tool  →  model  →  ...  →  thôi gọi tool  →  trả lời
 * </pre>
 *
 * <p><b>Vì sao phải tự viết.</b> Bản trước gói cả lượt trong {@code ChatClient.call()}, nên số vòng
 * là chi tiết cài đặt của thư viện. Ba hệ quả đã đo được, tất cả đều im lặng:
 * <ul>
 *   <li>{@code .call()} cho model 5–6 vòng để tự sửa lời gọi tool hỏng, {@code .stream()} chỉ ~3 —
 *       bộ 21 ca điền form tụt 21/21 → 17/21 mà không báo lỗi gì;</li>
 *   <li>kết quả tool chỉ model đọc được, nên trạng thái phải móc ra bằng sáu {@code ThreadLocal};</li>
 *   <li>không có chỗ chen vào giữa hai bước, nên công đoạn kiểm duyệt chỉ khám nghiệm được văn bản
 *       cuối cùng.</li>
 * </ul>
 *
 * <p><b>Ngân sách bước.</b> {@code app.ai.agent.max-steps}, mặc định {@value #DEFAULT_MAX_STEPS}.
 * Đặt CAO hơn hẳn số vòng model thường dùng (5–6) là có chủ đích: đây là lưới chặn chạy loạn, không
 * phải van bóp cho model tiết kiệm. Bóp thấp là tái lập đúng lỗi đã làm hỏng bộ 21 ca.
 *
 * <p>Hết ngân sách KHÔNG ném ngoại lệ mà bật cờ {@code budgetExhausted}: tầng trên còn giữ ngữ cảnh
 * và tự quyết định nói gì với người dùng.
 */
@Component
@Slf4j
public class AgentLoop {

    /** Xem ghi chú ở đầu lớp: lưới chặn chạy loạn, không phải van tiết kiệm. */
    static final String DEFAULT_MAX_STEPS = "10";

    private final ModelGateway gateway;

    @Value("${app.ai.agent.max-steps:" + DEFAULT_MAX_STEPS + "}")
    int maxSteps;

    public AgentLoop(ModelGateway gateway) {
        this.gateway = gateway;
    }

    /**
     * Chạy tới khi model thôi gọi tool, hoặc tới khi hết ngân sách bước.
     *
     * @return câu trả lời của model; {@code null} khi hết ngân sách mà model vẫn còn đòi gọi tool
     */
    public String run(AgentState state, List<Message> initial, ChatOptions options) {
        state.setMessages(initial);
        Prompt prompt = new Prompt(state.getMessages(), options);

        for (int step = 1; step <= maxSteps; step++) {
            state.setStep(step);
            ChatResponse response = gateway.call(prompt);

            if (response == null || !response.hasToolCalls()) {
                String answer = textOf(response);
                state.setAnswer(answer);
                log.debug("Vòng lặp xong sau {} bước, {} lời gọi tool", step, state.getRequested().size());
                return answer;
            }

            recordCalls(state, response);
            ToolExecutionResult result = gateway.executeToolCalls(prompt, response);
            state.setMessages(result.conversationHistory());

            // Tool khai returnDirect thì kết quả của nó CHÍNH LÀ câu trả lời — không hỏi model nữa.
            // Chưa tool nào trong dự án dùng cờ này, nhưng bỏ qua nó là âm thầm gọi thừa một vòng.
            if (result.returnDirect()) {
                String direct = lastText(state);
                state.setAnswer(direct);
                return direct;
            }
            prompt = new Prompt(state.getMessages(), options);
        }

        // Model vẫn đòi gọi tool sau maxSteps vòng. Nghi chạy loạn — ghi đủ để lần sau dò được nó
        // lặp ở tool nào.
        state.setBudgetExhausted(true);
        log.warn("Hết ngân sách {} bước mà model vẫn gọi tool. question='{}', đã gọi: {}",
                maxSteps, state.questionOrNa(), state.getSucceeded());
        return null;
    }

    /** Ghi lại các tool model vừa yêu cầu, NGAY KHI yêu cầu chứ không đợi chúng trả về. */
    private static void recordCalls(AgentState state, ChatResponse response) {
        for (AssistantMessage.ToolCall call : response.getResult().getOutput().getToolCalls()) {
            state.recordRequest(new ToolCallRecord(state.getStep(), call.id(), call.name(), true));
        }
    }

    private static String textOf(ChatResponse response) {
        if (response == null || response.getResult() == null
                || response.getResult().getOutput() == null) {
            return null;
        }
        return response.getResult().getOutput().getText();
    }

    private static String lastText(AgentState state) {
        List<Message> messages = state.getMessages();
        return messages.isEmpty() ? null : messages.get(messages.size() - 1).getText();
    }
}
