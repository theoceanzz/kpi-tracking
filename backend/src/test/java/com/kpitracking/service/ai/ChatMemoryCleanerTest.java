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
 * <p>Bất biến: bộ nhớ phải luôn kết thúc bằng CÂU TRẢ LỜI — người dùng trả tiền token cho mọi thứ
 * còn nằm trong đó, và một câu hỏi mồ côi làm mọi lượt sau đọc lại chính nó.
 *
 * <p><b>Chỉ còn một hàm để kiểm.</b> {@code dropLastExchange} đã bỏ cùng lúc với
 * {@code PlanCompletionStage}: nó tồn tại chỉ để dọn hộ khâu hỏi lại, mà khâu đó nay là một cạnh
 * của đồ thị agent và bộ nhớ chỉ được ghi ở đỉnh cuối, đúng một lần — không còn gì để dọn.
 */
class ChatMemoryCleanerTest {

    private final ChatMemoryRepository repo = mock(ChatMemoryRepository.class);
    private final ChatMemoryCleaner cleaner = new ChatMemoryCleaner(repo);

    private void given(Message... messages) {
        when(repo.findByConversationId("conv-1")).thenReturn(List.of(messages));
    }

    @Test
    @DisplayName("bộ nhớ kết thúc bằng CÂU HỎI mồ côi thì xoá đúng câu hỏi đó")
    void dropsOrphanUserMessage() {
        given(new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"), new UserMessage("hỏi 2"));

        cleaner.dropOrphanUserMessage("conv-1");

        verify(repo).saveAll(eq("conv-1"), eq(List.of(
                new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"))));
    }

    @Test
    @DisplayName("bộ nhớ đã kết thúc bằng câu TRẢ LỜI thì không đụng vào — đó là trạng thái đúng")
    void leavesHealthyMemoryAlone() {
        given(new UserMessage("hỏi 1"), new AssistantMessage("đáp 1"));

        cleaner.dropOrphanUserMessage("conv-1");

        verify(repo, never()).saveAll(anyString(), anyList());
    }

    @Test
    @DisplayName("bộ nhớ rỗng hoặc không có id thì không đụng vào kho")
    void noopOnEmptyOrMissingConversation() {
        when(repo.findByConversationId("conv-1")).thenReturn(List.of());
        cleaner.dropOrphanUserMessage("conv-1");
        cleaner.dropOrphanUserMessage(null);
        cleaner.dropOrphanUserMessage("  ");

        verify(repo, never()).saveAll(anyString(), anyList());
    }

    @Test
    @DisplayName("lỗi kho KHÔNG được ném ra ngoài — dọn dẹp hỏng không được làm hỏng lượt hỏi")
    void repositoryFailureIsSwallowed() {
        when(repo.findByConversationId("conv-1")).thenThrow(new RuntimeException("mất kết nối"));

        cleaner.dropOrphanUserMessage("conv-1");   // không được ném
    }
}
