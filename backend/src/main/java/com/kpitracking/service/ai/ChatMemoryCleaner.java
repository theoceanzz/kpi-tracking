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
 * <p>Tách thành bean riêng vì có hai chỗ cần: {@code ModelCallStage} khi model trả nội dung rỗng,
 * và {@link AiTurnPipeline} khi cả lượt ném lỗi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryCleaner {

    private final ChatMemoryRepository chatMemoryRepository;

    /**
     * Xoá cặp (câu hỏi, câu trả lời) CUỐI CÙNG khỏi bộ nhớ hội thoại.
     *
     * <p>Dùng khi một lượt được hỏi LẠI: advisor đã kịp ghi câu hỏi và câu trả lời thiếu sót của
     * lần đầu, nên nếu không xoá thì hội thoại giữ lại cùng một câu hỏi hai lần cùng một câu trả
     * lời sai — vừa tốn token cho mọi lượt sau, vừa để model đọc lại chính câu trả lời hỏng của nó.
     */
    public void dropLastExchange(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return;
        try {
            List<Message> messages = chatMemoryRepository.findByConversationId(conversationId);
            if (messages.isEmpty()) return;

            int end = messages.size();
            if (messages.get(end - 1).getMessageType() == MessageType.ASSISTANT) end--;
            if (end > 0 && messages.get(end - 1).getMessageType() == MessageType.USER) end--;
            if (end == messages.size()) return; // không khớp hình dạng mong đợi -> không đụng vào

            chatMemoryRepository.saveAll(conversationId, new ArrayList<>(messages.subList(0, end)));
        } catch (Exception e) {
            log.warn("Không xoá được cặp hỏi-đáp cuối trong bộ nhớ hội thoại {}: {}",
                    conversationId, e.getMessage());
        }
    }

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
