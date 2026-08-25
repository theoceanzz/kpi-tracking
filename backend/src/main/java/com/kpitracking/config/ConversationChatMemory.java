package com.kpitracking.config;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Bộ nhớ hội thoại: <b>ghi thêm để lưu, đọc cửa sổ để nhắc model</b>.
 *
 * <p><b>Vì sao phải tự viết thay vì dùng {@code MessageWindowChatMemory}.</b> Bảng {@code messages}
 * phục vụ HAI chủ có yêu cầu ngược nhau:
 * <ul>
 *   <li>model chỉ cần vài tin gần nhất — thừa ra là tốn token;</li>
 *   <li>giao diện phải hiện ĐỦ lịch sử hội thoại — mất tin là mất dữ liệu của người dùng.</li>
 * </ul>
 *
 * <p>{@code MessageWindowChatMemory} cắt danh sách còn {@code maxMessages} rồi gọi
 * {@code saveAll(conversationId, window)}, mà {@code DatabaseChatMemoryRepository.saveAll} có ngữ
 * nghĩa THAY THẾ: nó {@code DELETE} sạch rồi ghi lại. Nghĩa là chính sách cửa sổ của model bị áp
 * thẳng lên KHO LƯU — mọi hội thoại vĩnh viễn chỉ còn đúng {@code maxMessages} tin cuối, và xoá là
 * xoá CỨNG.
 *
 * <p>Đo được trên cơ sở dữ liệu thật trước khi vá: 8 hội thoại có đúng 2 tin, 1 hội thoại có đúng
 * 5 tin, KHÔNG cái nào quá 5 — trần đúng bằng {@code maxMessages(5)} lúc đó. Và {@code msg_index}
 * luôn đếm lại từ 0, dấu vết của việc xoá rồi ghi lại.
 *
 * <p>Ở đây tách hẳn hai việc: {@link #add} chỉ GHI THÊM (không xoá gì), còn {@link #get} trả về
 * {@value #DEFAULT_WINDOW} tin cuối cho model. Lịch sử đầy đủ nằm nguyên trong bảng, và
 * {@code ConversationService.getMessages} — nơi giao diện đọc — vốn đã phân trang nên lịch sử dài
 * bao nhiêu cũng không thành vấn đề.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ConversationChatMemory implements ChatMemory {

    /**
     * Số tin nhắn nhắc lại cho model, tính theo TIN chứ không theo lượt — 10 tin là 5 lượt hỏi đáp.
     *
     * <p>Mức cũ là 5, tức 2,5 lượt: hỏi "còn đơn vị nào nữa" ở lượt thứ tư là model đã quên ngữ
     * cảnh. Đây là con số đánh đổi với token nên để chỉnh được qua cấu hình.
     */
    static final String DEFAULT_WINDOW = "10";

    private final ConversationMessageRepository messageRepository;

    @Value("${app.ai.memory.window-messages:" + DEFAULT_WINDOW + "}")
    int windowMessages;

    /**
     * Ghi thêm vào cuối hội thoại. KHÔNG xoá gì, KHÔNG cắt gì.
     *
     * <p>Bỏ tin TRÙNG LIÊN TIẾP (cùng vai trò, cùng nội dung) — luật này mang sang nguyên từ
     * {@code DatabaseChatMemoryRepository.saveAll}: một lượt lỗi giữa chừng có thể để lại câu hỏi
     * mồ côi, và người dùng hỏi lại y hệt sẽ khiến nó nằm hai lần trong prompt.
     */
    @Override
    @Transactional
    public void add(String conversationId, List<Message> messages) {
        if (conversationId == null || conversationId.isBlank() || messages == null) return;
        UUID id = UUID.fromString(conversationId);

        List<ConversationMessage> existing = messageRepository.findByConversationIdOrderByMsgIndex(id);
        int nextIndex = existing.isEmpty() ? 0 : existing.get(existing.size() - 1).getMsgIndex() + 1;
        String prevRole = existing.isEmpty() ? null : existing.get(existing.size() - 1).getRole();
        String prevContent = existing.isEmpty() ? null : existing.get(existing.size() - 1).getContent();

        List<ConversationMessage> toSave = new ArrayList<>();
        for (Message message : messages) {
            String content = message.getText();
            if (content == null || content.isBlank()) continue;
            String role = message.getMessageType().getValue();
            if (role.equals(prevRole) && content.equals(prevContent)) continue;
            prevRole = role;
            prevContent = content;
            toSave.add(ConversationMessage.builder()
                    .conversationId(id)
                    .role(role)
                    .content(content)
                    .msgIndex(nextIndex++)
                    .build());
        }
        if (toSave.isEmpty()) return;

        messageRepository.saveAll(toSave);
        log.info("Ghi thêm {} tin vào hội thoại {} (tổng {})",
                toSave.size(), conversationId, existing.size() + toSave.size());
    }

    /** {@value #DEFAULT_WINDOW} tin CUỐI cho model đọc; lịch sử đầy đủ vẫn nằm nguyên trong bảng. */
    @Override
    @Transactional(readOnly = true)
    public List<Message> get(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return List.of();
        List<ConversationMessage> all =
                messageRepository.findByConversationIdOrderByMsgIndex(UUID.fromString(conversationId));

        int from = Math.max(0, all.size() - Math.max(1, windowMessages));
        List<Message> window = all.subList(from, all.size()).stream()
                .map(ConversationChatMemory::toSpringAiMessage)
                .filter(java.util.Objects::nonNull)
                .toList();

        log.info("Nhắc lại {}/{} tin của hội thoại {}", window.size(), all.size(), conversationId);
        return window;
    }

    /** Xoá sạch hội thoại. Chỉ dùng khi thật sự muốn bỏ, không phải để cắt cửa sổ. */
    @Override
    @Transactional
    public void clear(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return;
        messageRepository.deleteByConversationId(UUID.fromString(conversationId));
    }

    private static Message toSpringAiMessage(ConversationMessage m) {
        String role = m.getRole() == null ? "" : m.getRole();
        if (MessageType.ASSISTANT.getValue().equalsIgnoreCase(role)) {
            return new AssistantMessage(m.getContent());
        }
        if (MessageType.SYSTEM.getValue().equalsIgnoreCase(role)) {
            return new SystemMessage(m.getContent());
        }
        return new UserMessage(m.getContent());
    }
}
