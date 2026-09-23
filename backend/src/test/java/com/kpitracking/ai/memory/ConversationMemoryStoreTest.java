package com.kpitracking.ai.memory;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho kho lịch sử hội thoại: GHI THÊM để lưu, ĐỌC CỬA SỔ để nhắc model.
 *
 * <p>Hai tính chất được chốt vì mỗi cái từng là một lỗi thật: kho không bao giờ xoá (bản cũ xoá
 * sạch rồi ghi lại 5 tin, đo được trên CSDL thật), và cửa sổ chỉ là phần đọc — lịch sử dài bao
 * nhiêu cũng còn nguyên.
 */
class ConversationMemoryStoreTest {

    private static final String CONV = "11111111-2222-3333-4444-555555555555";

    private ConversationMessageRepository repo;
    private ConversationMemoryStore store;

    @BeforeEach
    void setUp() {
        repo = mock(ConversationMessageRepository.class);
        store = new ConversationMemoryStore(repo);
        store.windowMessages = 4;
    }

    private static ConversationMessage msg(int index, String role, String content) {
        return ConversationMessage.builder().id(UUID.randomUUID()).conversationId(UUID.fromString(CONV))
                .role(role).content(content).msgIndex(index).build();
    }

    @Test
    @DisplayName("window(): chỉ N tin CUỐI, đổi sang kiểu langchain4j đúng vai")
    void windowReturnsLastMessagesAsLangchainTypes() {
        when(repo.findByConversationIdOrderByMsgIndex(UUID.fromString(CONV))).thenReturn(List.of(
                msg(0, "user", "h1"), msg(1, "assistant", "d1"), msg(2, "user", "h2"),
                msg(3, "assistant", "d2"), msg(4, "user", "h3"), msg(5, "assistant", "d3")));

        List<ChatMessage> w = store.window(CONV);

        assertThat(w).containsExactly(UserMessage.from("h2"), AiMessage.from("d2"),
                UserMessage.from("h3"), AiMessage.from("d3"));
    }

    @Test
    @DisplayName("append(): GHI THÊM với msg_index nối tiếp — KHÔNG xoá gì")
    void appendNeverDeletes() {
        when(repo.findByConversationIdOrderByMsgIndex(UUID.fromString(CONV)))
                .thenReturn(List.of(msg(0, "user", "h1"), msg(1, "assistant", "d1")));

        store.append(CONV, "h2", "d2");

        verify(repo, never()).deleteByConversationId(any());
        verify(repo, never()).deleteById(any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ConversationMessage>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(ConversationMessage::getMsgIndex).containsExactly(2, 3);
        assertThat(saved.getValue()).extracting(ConversationMessage::getRole).containsExactly("user", "assistant");
    }

    @Test
    @DisplayName("append(): tin trùng liên tiếp với tin cuối đã lưu thì bỏ — không để câu hỏi nằm hai lần")
    void appendSkipsConsecutiveDuplicate() {
        // Lượt trước lỗi giữa chừng để lại câu hỏi "h2" mồ côi; người dùng hỏi lại y hệt.
        when(repo.findByConversationIdOrderByMsgIndex(UUID.fromString(CONV)))
                .thenReturn(List.of(msg(0, "user", "h1"), msg(1, "assistant", "d1"), msg(2, "user", "h2")));

        store.append(CONV, "h2", "d2");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ConversationMessage>> saved = ArgumentCaptor.forClass(List.class);
        verify(repo).saveAll(saved.capture());
        assertThat(saved.getValue()).hasSize(1);
        assertThat(saved.getValue().get(0).getRole()).isEqualTo("assistant");
        assertThat(saved.getValue().get(0).getMsgIndex()).isEqualTo(3);
    }

    @Test
    @DisplayName("không có id hội thoại -> không chạm kho")
    void noConversationIsNoop() {
        assertThat(store.window(null)).isEmpty();
        assertThat(store.window("  ")).isEmpty();
        store.append(null, "h", "d");
        verify(repo, never()).saveAll(any());
    }
}
