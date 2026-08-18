package com.kpitracking.service.ai;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test cho việc dọn bộ nhớ hội thoại.
 *
 * <p>Bất biến: bộ nhớ phải luôn kết thúc bằng CÂU TRẢ LỜI, và không được đọng lại câu hỏi trùng
 * kèm câu trả lời hỏng — người dùng trả tiền token cho mọi thứ còn nằm trong đó.
 */
class ChatMemoryCleanerTest {

    private final ChatMemoryRepository repo = mock(ChatMemoryRepository.class);
    private final ChatMemoryCleaner cleaner = new ChatMemoryCleaner(repo);

    private void given(Message... messages) {
        when(repo.findByConversationId("conv-1")).thenReturn(List.of(messages));
    }

    @Test
    @DisplayName("xoá đúng cặp hỏi-đáp cuối, giữ nguyên phần trước")
    void dropsLastExchange() {
        given(new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"),
              new UserMessage("hỏi 2"), new AssistantMessage("đáp 2 thiếu sót"));

        cleaner.dropLastExchange("conv-1");

        verify(repo).saveAll(eq("conv-1"), eq(List.of(
                new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"))));
    }

    @Test
    @DisplayName("bộ nhớ kết thúc bằng CÂU HỎI mồ côi thì cũng xoá được câu hỏi đó")
    void dropsOrphanUserWhenNoAnswerYet() {
        given(new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"), new UserMessage("hỏi 2"));

        cleaner.dropLastExchange("conv-1");

        verify(repo).saveAll(eq("conv-1"), eq(List.of(
                new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"))));
    }

    @Test
    @DisplayName("bộ nhớ rỗng hoặc không có id thì không đụng vào kho")
    void noopOnEmptyOrMissingConversation() {
        when(repo.findByConversationId("conv-1")).thenReturn(List.of());
        cleaner.dropLastExchange("conv-1");
        cleaner.dropLastExchange(null);
        cleaner.dropLastExchange("  ");

        verify(repo, never()).saveAll(anyString(), anyList());
    }

    @Test
    @DisplayName("lỗi kho KHÔNG được ném ra ngoài — dọn dẹp hỏng không được làm hỏng lượt hỏi")
    void repositoryFailureIsSwallowed() {
        when(repo.findByConversationId("conv-1")).thenThrow(new RuntimeException("mất kết nối"));

        cleaner.dropLastExchange("conv-1");   // không được ném
        cleaner.dropOrphanUserMessage("conv-1");
    }
}
