package com.kpitracking.service.ai.agent.node;

import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.ModelGateway;
import com.kpitracking.service.ai.agent.Node;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Chạy các tool model vừa yêu cầu, rồi trả lịch sử hội thoại đã có kết quả về cho đỉnh MODEL.
 *
 * <p>Đây là chỗ kết quả tool trở thành GIÁ TRỊ đọc được: {@code conversationHistory()} là một danh
 * sách nằm trong tay ta, không phải một chuỗi chỉ model nhìn thấy. Chính vì bản trước không có chỗ
 * này mà trạng thái của tool phải móc ra bằng sáu {@code ThreadLocal}.
 */
@Component
@RequiredArgsConstructor
public class ActNode implements Node {

    private final ModelGateway gateway;

    @Override
    public AgentNode id() {
        return AgentNode.ACT;
    }

    @Override
    public AgentNode run(AgentState state) {
        ToolExecutionResult result =
                gateway.executeToolCalls(state.getLastPrompt(), state.getLastResponse());
        state.setMessages(result.conversationHistory());

        // Tool khai returnDirect thì kết quả của nó CHÍNH LÀ câu trả lời — không hỏi model nữa.
        // Chưa tool nào trong dự án dùng cờ này, nhưng bỏ qua nó là âm thầm gọi thừa một vòng.
        if (result.returnDirect()) {
            state.setAnswer(lastText(state));
            return AgentNode.OBSERVE;
        }
        return AgentNode.MODEL;
    }

    private static String lastText(AgentState state) {
        List<Message> messages = state.getMessages();
        return messages.isEmpty() ? null : messages.get(messages.size() - 1).getText();
    }
}
