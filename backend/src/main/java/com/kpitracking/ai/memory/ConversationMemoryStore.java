package com.kpitracking.ai.memory;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Kho lịch sử hội thoại: <b>ghi thêm để lưu, đọc cửa sổ để nhắc model</b>.
 *
 * <p>Port từ {@code ConversationChatMemory} (Spring AI) sang kiểu tin nhắn của langchain4j, giữ
 * nguyên hai quyết định đã đo được lý do:
 * <ul>
 *   <li>{@link #append} CHỈ ghi thêm — bản trước dùng {@code MessageWindowChatMemory} với kho có ngữ
 *       nghĩa thay thế, và mọi hội thoại vĩnh viễn chỉ còn 5 tin cuối (đo trên CSDL thật);</li>
 *   <li>{@link #window} trả về {@value #DEFAULT_WINDOW} tin cuối — 5 lượt hỏi đáp; mức 5 tin cũ là
 *       2,5 lượt, hỏi "còn đơn vị nào nữa" ở lượt thứ tư là model đã quên ngữ cảnh.</li>
 * </ul>
 *
 * <p>Chỉ giữ tin NGƯỜI DÙNG và TRỢ LÝ. Tin hệ thống và tin gọi tool là của một lượt, không phải của
 * hội thoại; lưu chúng là vừa tốn chỗ vừa để lượt sau đọc lại kết quả tool đã cũ.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationMemoryStore {

    static final String DEFAULT_WINDOW = "10";
    static final String ROLE_USER = "user";
    static final String ROLE_ASSISTANT = "assistant";

    private final ConversationMessageRepository messageRepository;

    @Value("${app.ai.memory.window-messages:" + DEFAULT_WINDOW + "}")
    int windowMessages;

    /** Các tin cuối của hội thoại, đã đổi sang kiểu langchain4j. */
    @Transactional(readOnly = true)
    public List<ChatMessage> window(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return List.of();
        List<ConversationMessage> all =
                messageRepository.findByConversationIdOrderByMsgIndex(UUID.fromString(conversationId));
        int from = Math.max(0, all.size() - Math.max(1, windowMessages));
        List<ChatMessage> out = new ArrayList<>();
        for (ConversationMessage m : all.subList(from, all.size())) {
            if (m.getContent() == null || m.getContent().isBlank()) continue;
            out.add(ROLE_ASSISTANT.equalsIgnoreCase(m.getRole())
                    ? AiMessage.from(m.getContent())
                    : UserMessage.from(m.getContent()));
        }
        log.info("Nhắc lại {}/{} tin của hội thoại {}", out.size(), all.size(), conversationId);
        return out;
    }

    /**
     * Ghi một cặp hỏi–đáp vào cuối hội thoại. KHÔNG xoá gì, KHÔNG cắt gì.
     *
     * <p>Bỏ tin trùng liên tiếp (cùng vai, cùng nội dung): một lượt lỗi giữa chừng có thể để lại
     * câu hỏi mồ côi, và người dùng hỏi lại y hệt sẽ khiến nó nằm hai lần trong prompt.
     */
    @Transactional
    public void append(String conversationId, String question, String answer) {
        if (conversationId == null || conversationId.isBlank()) return;
        UUID id = UUID.fromString(conversationId);

        List<ConversationMessage> existing = messageRepository.findByConversationIdOrderByMsgIndex(id);
        int nextIndex = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getMsgIndex() + 1;
        String prevRole = existing.isEmpty() ? null : existing.get(existing.size() - 1).getRole();
        String prevContent = existing.isEmpty() ? null : existing.get(existing.size() - 1).getContent();

        List<ConversationMessage> toSave = new ArrayList<>();
        for (String[] pair : new String[][]{{ROLE_USER, question}, {ROLE_ASSISTANT, answer}}) {
            String role = pair[0], content = pair[1];
            if (content == null || content.isBlank()) continue;
            if (role.equals(prevRole) && content.equals(prevContent)) continue;
            prevRole = role;
            prevContent = content;
            toSave.add(ConversationMessage.builder()
                    .conversationId(id).role(role).content(content).msgIndex(nextIndex++).build());
        }
        if (toSave.isEmpty()) return;
        messageRepository.saveAll(toSave);
        log.info("Ghi thêm {} tin vào hội thoại {} (tổng {})",
                toSave.size(), conversationId, existing.size() + toSave.size());
    }
}
