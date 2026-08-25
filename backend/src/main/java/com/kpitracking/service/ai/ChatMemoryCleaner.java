package com.kpitracking.service.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Dọn câu hỏi mồ côi trong bộ nhớ hội thoại.
 *
 * <p>Bộ nhớ hội thoại phải luôn kết thúc bằng CÂU TRẢ LỜI. Advisor ghi câu hỏi vào bộ nhớ TRƯỚC
 * khi gọi model, nên khi lượt chat lỗi (hết credit, provider trả 400, timeout...) câu hỏi nằm lại
 * mà không có câu trả lời đi kèm. Người dùng hỏi lại y hệt thì câu đó xuất hiện HAI lần trong
 * prompt — tốn token và model dễ hiểu nhầm.
 *
 * <p><b>Chỉ còn một chỗ cần: {@link AiTurnPipeline} khi cả lượt ném lỗi.</b> Hai nguồn sinh ra
 * trạng thái bẩn kia đã bị bịt ở gốc — không còn advisor ghi câu hỏi trước khi gọi model, và bộ nhớ
 * chỉ được ghi ở đỉnh cuối của đồ thị agent, đúng một lần, sau khi đã có câu trả lời. Hàm
 * {@code dropLastExchange} từng dọn hộ khâu hỏi lại cũng đã bỏ theo: khâu đó nay là một cạnh của đồ
 * thị nên không làm bẩn gì để phải dọn.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryCleaner {

    private final ChatMemoryRepository chatMemoryRepository;

    public void dropOrphanUserMessage(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return;
        try {
            List<Message> messages = chatMemoryRepository.findByConversationId(conversationId);
            if (messages.isEmpty()) return;
            if (messages.get(messages.size() - 1).getMessageType() != MessageType.USER) return;
            chatMemoryRepository.saveAll(conversationId,
                    new ArrayList<>(messages.subList(0, messages.size() - 1)));
        } catch (Exception e) {
            log.warn("Không dọn được câu hỏi mồ côi trong bộ nhớ hội thoại {}: {}", conversationId, e.getMessage());
        }
    }
}
