package com.kpitracking.service.ai;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
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
 * <p><b>Điều quan trọng nhất lớp này chốt: xoá đúng MỘT dòng.</b> Bản trước gọi
 * {@code saveAll(id, toànBộTrừDòngCuối)} — một hàm có ngữ nghĩa THAY THẾ, tức xoá sạch rồi chèn
 * lại cả hội thoại. Hồi lịch sử còn bị chặn ở 5 tin thì rẻ; từ khi lịch sử giữ đầy đủ, đó là một
 * lần ghi lại toàn bộ hội thoại ngay trên ĐƯỜNG LỖI.
 */
class ChatMemoryCleanerTest {

    private static final String CONV = "11111111-2222-3333-4444-555555555555";

    private final ConversationMessageRepository repo = mock(ConversationMessageRepository.class);
    private final ChatMemoryCleaner cleaner = new ChatMemoryCleaner(repo);

    private static ConversationMessage msg(String role, String content) {
        return ConversationMessage.builder()
                .id(UUID.randomUUID())
                .conversationId(UUID.fromString(CONV))
                .role(role)
                .content(content)
                .build();
    }

    private void given(ConversationMessage... messages) {
        when(repo.findByConversationIdOrderByMsgIndex(UUID.fromString(CONV)))
                .thenReturn(List.of(messages));
    }

    @Test
    @DisplayName("kết thúc bằng CÂU HỎI mồ côi -> xoá đúng dòng đó, KHÔNG đụng dòng nào khác")
    void dropsOrphanUserMessage() {
        ConversationMessage orphan = msg("user", "hỏi 2");
        given(msg("user", "hỏi 1"), msg("assistant", "đáp 1"), orphan);

        cleaner.dropOrphanUserMessage(CONV);

        verify(repo).deleteById(orphan.getId());
        // Xoá cả hội thoại rồi chèn lại là cách bản trước làm — đắt, và đắt đúng lúc đang có sự cố.
        verify(repo, never()).deleteByConversationId(any());
        verify(repo, never()).saveAll(any());
    }

    @Test
    @DisplayName("đã kết thúc bằng câu TRẢ LỜI -> không đụng vào, đó là trạng thái đúng")
    void leavesHealthyMemoryAlone() {
        given(msg("user", "hỏi 1"), msg("assistant", "đáp 1"));

        cleaner.dropOrphanUserMessage(CONV);

        verify(repo, never()).deleteById(any());
    }

    @Test
    @DisplayName("hội thoại rỗng hoặc không có id -> không đụng vào kho")
    void noopOnEmptyOrMissingConversation() {
        when(repo.findByConversationIdOrderByMsgIndex(any())).thenReturn(List.of());

        cleaner.dropOrphanUserMessage(CONV);
        cleaner.dropOrphanUserMessage(null);
        cleaner.dropOrphanUserMessage("  ");

        verify(repo, never()).deleteById(any());
    }

    @Test
    @DisplayName("lỗi kho KHÔNG được ném ra ngoài — dọn dẹp hỏng không được làm hỏng lượt hỏi")
    void repositoryFailureIsSwallowed() {
        when(repo.findByConversationIdOrderByMsgIndex(any()))
                .thenThrow(new RuntimeException("mất kết nối"));

        cleaner.dropOrphanUserMessage(CONV);   // không được ném
    }

    @Test
    @DisplayName("id hội thoại KHÔNG phải UUID -> nuốt lỗi, không nổ giữa lượt")
    void malformedIdIsSwallowed() {
        cleaner.dropOrphanUserMessage("khong-phai-uuid");

        verify(repo, never()).deleteById(any());
    }
}
