package com.kpitracking.advisor;

import com.kpitracking.service.AiTokenUsageRecorder;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClientRequest;
import org.springframework.ai.chat.client.ChatClientResponse;
import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import reactor.core.publisher.Flux;

/**
 * Ghi nhận token đã tiêu của mỗi lượt gọi LLM.
 *
 * <p>Advisor này là default advisor của <b>cả hai</b> ChatClient bean trong {@code ChatModelConfig},
 * mà mọi điểm gọi LLM đều dùng một trong hai bean đó — nên chỉ cần ở đây là bao trọn 100% lượt gọi,
 * không phải sửa chỗ gọi nào.
 *
 * <p>{@code getOrder() == 1} đặt nó ngoài cùng chuỗi advisor nên nó thấy phản hồi cuối cùng, sau khi
 * vòng lặp gọi tool đã xong. Spring AI cộng dồn {@code Usage} qua tất cả vòng gọi tool của một lượt
 * ({@code UsageCalculator.getCumulativeUsage}), nên số liệu ở đây là đầy đủ cho cả lượt.
 */
@RequiredArgsConstructor
public class TokenUsageAuditAdvisor implements CallAdvisor, StreamAdvisor {

    private static final Logger logger = LoggerFactory.getLogger(TokenUsageAuditAdvisor.class);

    private final AiTokenUsageRecorder recorder;

    @Override
    public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain callAdvisorChain) {
        ChatClientResponse chatClientResponse = callAdvisorChain.nextCall(chatClientRequest);
        record(chatClientResponse);
        return chatClientResponse;
    }

    private void record(ChatClientResponse chatClientResponse) {
        try {
            if (chatClientResponse == null) return;
            ChatResponse chatResponse = chatClientResponse.chatResponse();
            if (chatResponse == null || chatResponse.getMetadata() == null) return;

            Usage usage = chatResponse.getMetadata().getUsage();
            if (usage == null) return;

            logger.info("Token usage details: {}", usage);
            recorder.record(usage, chatResponse.getMetadata().getModel());
        } catch (Exception e) {
            // Không để việc ghi nhận làm hỏng câu trả lời đã có sẵn cho người dùng.
            logger.error("Không ghi được tiêu thụ token: {}", e.getMessage(), e);
        }
    }

    @Override
    public String getName() {
        return this.getClass().getName();
    }

    @Override
    public int getOrder() {
        return 1;
    }

    @Override
    public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest,
                                                 StreamAdvisorChain streamAdvisorChain) {
        // Hiện không có luồng streaming nào. Trả chuỗi nguyên vẹn thay vì null như trước,
        // để nếu sau này có ai bật streaming thì không nổ NullPointerException.
        return streamAdvisorChain.nextStream(chatClientRequest);
    }
}
