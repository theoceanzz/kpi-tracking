package com.kpitracking.service.ai;

import com.kpitracking.entity.ConversationMessage;
import com.kpitracking.repository.ConversationMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Dọn câu hỏi mồ côi trong bộ nhớ hội thoại.
 *
 * <p>Bộ nhớ hội thoại phải luôn kết thúc bằng CÂU TRẢ LỜI. Khi lượt chat lỗi (hết credit, provider
 * trả 400, timeout...) mà câu hỏi đã kịp nằm lại, người dùng hỏi lại y hệt thì câu đó xuất hiện HAI
 * lần trong prompt — tốn token và model dễ hiểu nhầm.
 *
 * <p><b>Chỉ còn một chỗ cần: {@link AiTurnPipeline} khi cả lượt ném lỗi.</b> Hai nguồn sinh ra
 * trạng thái bẩn kia đã bị bịt ở gốc — không còn advisor ghi câu hỏi trước khi gọi model, và bộ nhớ
 * chỉ được ghi ở đỉnh cuối của đồ thị agent, đúng một lần, sau khi đã có câu trả lời.
 *
 * <p><b>Xoá đúng MỘT dòng cuối, không ghi lại cả hội thoại.</b> Bản trước gọi
 * {@code ChatMemoryRepository.saveAll(id, toànBộTrừDòngCuối)}, mà hàm đó có ngữ nghĩa THAY THẾ:
 * xoá sạch rồi chèn lại. Hồi lịch sử còn bị chặn ở 5 tin thì rẻ; từ khi lịch sử giữ đầy đủ, đó là
 * một lần xoá-và-chèn toàn bộ hội thoại — trên ĐƯỜNG LỖI, đúng lúc hệ thống đang có vấn đề.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChatMemoryCleaner {

    private final ConversationMessageRepository messageRepository;

    public void dropOrphanUserMessage(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) return;
        try {
            List<ConversationMessage> messages = messageRepository
                    .findByConversationIdOrderByMsgIndex(UUID.fromString(conversationId));
            if (messages.isEmpty()) return;

            ConversationMessage last = messages.get(messages.size() - 1);
            if (!MessageType.USER.getValue().equalsIgnoreCase(last.getRole())) return;

            messageRepository.deleteById(last.getId());
            log.info("Đã dọn câu hỏi mồ côi ở cuối hội thoại {}", conversationId);
        } catch (Exception e) {
            log.warn("Không dọn được câu hỏi mồ côi trong bộ nhớ hội thoại {}: {}",
                    conversationId, e.getMessage());
        }
    }
}
