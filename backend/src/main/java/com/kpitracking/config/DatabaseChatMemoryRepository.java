package com.kpitracking.config;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseChatMemoryRepository implements ChatMemoryRepository {

    private final ConversationMessageRepository messageRepository;

    @Override
    public List<String> findConversationIds() {
        return List.of();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Message> findByConversationId(String conversationId) {
        UUID id = UUID.fromString(conversationId);
        List<Message> messages = messageRepository.findByConversationIdOrderByMsgIndex(id)
                .stream()
                .map(this::toSpringAiMessage)
                .toList();
        log.info("Loaded {} messages for conversationId={}", messages.size(), conversationId);
        return messages;
    }

    /**
     * REPLACE semantics: deletes all existing messages for the conversation,
     * then inserts the full processed list. Called by MessageWindowChatMemory.
     */
    @Override
    @Transactional
    public void saveAll(String conversationId, List<Message> messages) {
        UUID id = UUID.fromString(conversationId);

        messageRepository.deleteByConversationId(id);

        if (messages == null || messages.isEmpty()) {
            log.info("saveAll: cleared all messages for conversationId={}", conversationId);
            return;
        }

        List<ConversationMessage> toSave = new ArrayList<>();
        int index = 0;
        String prevRole = null;
        String prevContent = null;
        for (Message message : messages) {
            String content = message.getText();
            if (content == null || content.isBlank()) continue;

            String role = message.getMessageType().getValue();
            // Bỏ message TRÙNG LIÊN TIẾP (cùng vai trò + cùng nội dung). MessageChatMemoryAdvisor ghi
            // câu hỏi vào bộ nhớ TRƯỚC khi gọi model; nếu lượt đó lỗi (vd hết credit/timeout) thì câu
            // hỏi nằm lại mà không có câu trả lời — hỏi lại y hệt sẽ khiến nó xuất hiện hai lần trong
            // prompt (tốn token + model dễ hiểu nhầm là hỏi hai lần).
            if (role.equals(prevRole) && content.equals(prevContent)) continue;
            prevRole = role;
            prevContent = content;

            toSave.add(ConversationMessage.builder()
                    .conversationId(id)
                    .role(role)
                    .content(content)
                    .msgIndex(index++)
                    .build());
        }

        if (!toSave.isEmpty()) {
            messageRepository.saveAll(toSave);
            log.info("saveAll: saved {} messages for conversationId={}", toSave.size(), conversationId);
        }
    }

    @Override
    @Transactional
    public void deleteByConversationId(String conversationId) {
        messageRepository.deleteByConversationId(UUID.fromString(conversationId));
        log.info("Cleared memory for conversationId={}", conversationId);
    }

    private Message toSpringAiMessage(ConversationMessage msg) {
        return switch (msg.getRole()) {
            case "user" -> new UserMessage(msg.getContent());
            case "assistant" -> new AssistantMessage(msg.getContent());
            default -> new SystemMessage(msg.getContent());
        };
    }
}
