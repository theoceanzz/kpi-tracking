package com.kpitracking.service.ai.agent.node;

import com.kpitracking.advisor.ResponseSanitizingAdvisor;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentNode;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.agent.Node;
import com.kpitracking.tool.ToolRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Chốt lượt: lọc câu trả lời, ghi bộ nhớ hội thoại, và dừng đồ thị.
 *
 * <p><b>Bộ nhớ hội thoại chỉ được ghi ở ĐÂY, đúng một lần.</b> Đây là thứ khiến
 * {@code ChatMemoryCleaner.dropLastExchange} không còn cần thiết: bản trước mỗi lần hỏi đều ghi
 * ngay khi có câu trả lời, nên khâu bổ sung bước thiếu phải xoá cặp hỏi-đáp vừa ghi trước khi hỏi
 * lại. Nay các lần hỏi lại xảy ra TRƯỚC khi có gì được ghi, nên trạng thái bẩn đó không tạo ra
 * được nữa.
 *
 * <p><b>Lọc câu trả lời là tường minh.</b> Đường đi này không qua {@code ChatClient} nên
 * {@code ResponseSanitizingAdvisor} không tự chạy; gọi thẳng {@code sanitizeText} trên toàn văn —
 * đúng cách nhánh streaming vẫn làm từ trước.
 */
@Component
@Slf4j
public class FinishNode implements Node {

    /**
     * Tên mọi @Tool có thể gửi cho model, gom một lần bằng reflection để bộ lọc câu trả lời xoá
     * được tên tool bị lọt ra ngoài mà không phải duy trì danh sách trùng lặp.
     */
    private static final Set<String> TOOL_NAMES = collectToolNames();

    private static Set<String> collectToolNames() {
        Set<String> names = new LinkedHashSet<>();
        for (Class<?> toolClass : ToolRegistry.toolClasses()) {
            for (Method m : toolClass.getDeclaredMethods()) {
                org.springframework.ai.tool.annotation.Tool tool =
                        m.getAnnotation(org.springframework.ai.tool.annotation.Tool.class);
                if (tool == null) continue;
                names.add(tool.name() != null && !tool.name().isBlank() ? tool.name() : m.getName());
            }
        }
        return names;
    }

    private final ChatMemory chatMemory;

    public FinishNode(ChatMemory chatMemory) {
        this.chatMemory = chatMemory;
    }

    @Override
    public AgentNode id() {
        return AgentNode.FINISH;
    }

    @Override
    public AgentNode run(AgentState state) {
        AiTurn turn = state.getTurn();
        String raw = state.getAnswer();
        String result = raw == null ? null : new ResponseSanitizingAdvisor(TOOL_NAMES).sanitizeText(raw);

        if (result == null || result.isBlank()) {
            state.setAnswer(fallbackAnswer(state));
            return null;
        }
        state.setAnswer(result);
        remember(turn, result);
        return null;
    }

    /** Ghi vào bộ nhớ CHỈ KHI đã có câu trả lời — nên không tạo ra được câu hỏi mồ côi. */
    private void remember(AiTurn turn, String answer) {
        if (!turn.isHasMemory()) return;
        try {
            chatMemory.add(turn.getConversationId(),
                    List.of(new UserMessage(turn.getQuestion()), new AssistantMessage(answer)));
        } catch (Exception e) {
            // Bộ nhớ hỏng không được làm hỏng câu trả lời đã có sẵn cho người dùng.
            log.warn("Khong ghi duoc bo nho hoi thoai ({}), bo qua", e.getMessage());
        }
    }

    /**
     * Hai kiểu không có câu trả lời, và chúng cần hai câu KHÁC nhau: nói sai nguyên nhân thì người
     * dùng đi sửa sai chỗ.
     */
    private String fallbackAnswer(AgentState state) {
        if (state.isBudgetExhausted()) {
            log.warn("Vong lap het ngan sach buoc. question={}", state.questionOrNa());
            return "Xin lỗi, yêu cầu này cần quá nhiều bước tra cứu nên mình phải dừng giữa chừng. "
                    + "Bạn tách nhỏ câu hỏi giúp mình nhé — ví dụ hỏi từng đơn vị một.";
        }
        // Model suy luận (gpt-oss) đôi lúc tiêu hết token cho phần suy luận rồi chạm
        // finishReason=LENGTH trước khi kịp sinh text -> content rỗng.
        log.warn("AI tra noi dung rong (nghi finishReason=LENGTH). question={}", state.questionOrNa());
        return "Xin lỗi, mình chưa tạo được câu trả lời cho yêu cầu này (nội dung xử lý quá dài). "
                + "Bạn thử hỏi ngắn gọn/cụ thể hơn giúp mình nhé.";
    }
}
