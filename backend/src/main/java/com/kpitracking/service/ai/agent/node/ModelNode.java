package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.ModelGateway;
import com.kpitracking.service.ai.agent.Node;
import com.kpitracking.service.ai.agent.ToolCallRecord;
import com.kpitracking.service.ai.agent.TurnPromptBuilder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Một lời gọi model.
 *
 * <p>Vào đỉnh này với hội thoại RỖNG nghĩa là bắt đầu một lần hỏi mới, nên prompt được dựng lại từ
 * đầu; vào với hội thoại đã có nghĩa là vừa chạy tool xong, nên nói tiếp. Đó là toàn bộ khác biệt
 * giữa "hỏi lại" và "vòng tiếp theo của cùng một lần hỏi", và nó nằm ở MỘT câu {@code if} thay vì
 * ở việc chạy lại cả phần chuỗi phía sau.
 *
 * <p><b>Ngân sách bước.</b> {@code app.ai.agent.max-steps}, mặc định {@value #DEFAULT_MAX_STEPS}.
 * Đặt CAO hơn hẳn số vòng model thường dùng (5–6) là có chủ đích: đây là lưới chặn chạy loạn, không
 * phải van bóp cho model tiết kiệm. Bóp thấp là tái lập đúng lỗi đã làm bộ 21 ca điền form tụt
 * 21/21 → 17/21 khi bật streaming, và nó hỏng ÂM THẦM.
 *
 * <p>Hết ngân sách KHÔNG ném ngoại lệ mà bật cờ {@code budgetExhausted} rồi đi thẳng tới
 * {@link AgentNode#FINISH}: ở đó còn ngữ cảnh để nói với người dùng đúng lý do phải dừng.
 */
@Component
@Slf4j
public class ModelNode implements Node {

    /** Xem ghi chú ở đầu lớp: lưới chặn chạy loạn, không phải van tiết kiệm. */
    public static final String DEFAULT_MAX_STEPS = "10";

    private final ModelGateway gateway;
    private final TurnPromptBuilder promptBuilder;

    @Value("${app.ai.agent.max-steps:" + DEFAULT_MAX_STEPS + "}")
    int maxSteps;

    public ModelNode(ModelGateway gateway, TurnPromptBuilder promptBuilder) {
        this.gateway = gateway;
        this.promptBuilder = promptBuilder;
    }

    @Override
    public AgentNode id() {
        return AgentNode.MODEL;
    }

    @Override
    public AgentNode run(AgentState state) {
        AiTurn turn = state.getTurn();

        if (state.getMessages().isEmpty()) {
            state.setMessages(promptBuilder.buildMessages(turn));
            // Nhãn phát MỘT lần cho mỗi lần hỏi, không phát lại sau từng vòng gọi tool: giữa các
            // vòng đó ToolProgress đã báo tên từng thứ vừa tra, nên nhắc lại chỉ làm nhãn nhảy lui.
            turn.progress(id().name(), "Đang tra cứu dữ liệu");
        }

        if (state.getStep() >= maxSteps) {
            // Model vẫn đòi gọi tool sau maxSteps vòng. Nghi chạy loạn — ghi đủ để lần sau dò được
            // nó lặp ở tool nào.
            state.setBudgetExhausted(true);
            log.warn("Hết ngân sách {} bước mà model vẫn gọi tool. question='{}', đã gọi: {}",
                    maxSteps, state.questionOrNa(), state.getSucceeded());
            return AgentNode.FINISH;
        }
        state.setStep(state.getStep() + 1);

        Prompt prompt = new Prompt(state.getMessages(), promptBuilder.buildOptions(turn));
        // Truyền nơi nhận mẩu chữ ở MỌI vòng, không cố đoán trước vòng nào là vòng cuối — không thể
        // biết trước khi phản hồi về. Vòng gọi tool tự nhiên không sinh chữ nên nó không phát gì, và
        // nếu có thì mẩu chữ vốn đã được khai là bản XEM TRƯỚC phải bị thay ở sự kiện done.
        // Gateway tự bỏ qua nơi nhận này khi cờ streaming đang tắt.
        ChatResponse response = gateway.call(prompt, turn.getListener()::token);
        state.setLastPrompt(prompt);
        state.setLastResponse(response);

        if (response == null || !response.hasToolCalls()) {
            state.setAnswer(textOf(response));
            log.debug("Model trả lời sau {} bước, {} lời gọi tool",
                    state.getStep(), state.getRequested().size());
            return AgentNode.OBSERVE;
        }

        recordCalls(state, response);
        return AgentNode.ACT;
    }

    /** Ghi lại các tool model vừa yêu cầu, NGAY KHI yêu cầu chứ không đợi chúng trả về. */
    private static void recordCalls(AgentState state, ChatResponse response) {
        for (AssistantMessage.ToolCall call : response.getResult().getOutput().getToolCalls()) {
            state.recordRequest(new ToolCallRecord(state.getStep(), call.id(), call.name()));
        }
    }

    private static String textOf(ChatResponse response) {
        if (response == null || response.getResult() == null
                || response.getResult().getOutput() == null) {
            return null;
        }
        return response.getResult().getOutput().getText();
    }
}
