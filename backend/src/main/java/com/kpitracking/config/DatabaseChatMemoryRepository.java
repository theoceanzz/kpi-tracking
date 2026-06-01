package com.kpitracking.config;

import com.kpitracking.entity.Conversation;
import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import com.kpitracking.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
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
import java.util.concurrent.atomic.AtomicInteger;

@Component
@RequiredArgsConstructor
public class DatabaseChatMemoryRepository implements ChatMemoryRepository {

    private final ConversationRepository conversationRepository;
    private final ConversationMessageRepository messageRepository;

    @Override
    @Transactional(readOnly = true)
    public List<String> findConversationIds() {
        return conversationRepository.findAll()
                .stream()
                .map(c -> c.getId().toString())
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Message> findByConversationId(String conversationId) {
        UUID id = UUID.fromString(conversationId);
        return messageRepository.findByConversationIdOrderByMsgIndex(id)
                .stream()
                .map(this::toSpringAiMessage)
                .toList();
    }

    @Override
    @Transactional
    public void saveAll(String conversationId, List<Message> messages) {
        if (messages == null || messages.isEmpty()) return;

        UUID id = UUID.fromString(conversationId);
        Conversation conversation = conversationRepository.findById(id).orElse(null);
        if (conversation == null) return;

        int currentMax = messageRepository.findTopByConversationIdOrderByMsgIndexDesc(id)
                .map(ConversationMessage::getMsgIndex)
                .orElse(-1);

        AtomicInteger index = new AtomicInteger(currentMax + 1);
        List<ConversationMessage> toSave = new ArrayList<>();

        for (Message message : messages) {
            String role = message.getMessageType().getValue();
            String content = message.getText();
            if (content == null) continue;

            toSave.add(ConversationMessage.builder()
                    .conversation(conversation)
                    .role(role)
                    .content(content)
                    .msgIndex(index.getAndIncrement())
                    .build());
        }

        messageRepository.saveAll(toSave);
    }

    @Override
    @Transactional
    public void deleteByConversationId(String conversationId) {
        messageRepository.deleteByConversationId(UUID.fromString(conversationId));
    }

    private Message toSpringAiMessage(ConversationMessage msg) {
        return switch (msg.getRole()) {
            case "user" -> new UserMessage(msg.getContent());
            case "assistant" -> new AssistantMessage(msg.getContent());
            default -> new SystemMessage(msg.getContent());
        };
    }
}
