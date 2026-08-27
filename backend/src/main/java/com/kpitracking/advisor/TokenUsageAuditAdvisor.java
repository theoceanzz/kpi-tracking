package com.kpitracking.advisor;

import com.kpitracking.entity.AiTokenUsage;
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
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import reactor.core.publisher.Flux;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Ghi nhận token đã tiêu của mỗi lượt gọi LLM.
 *
 * <p>Advisor này là default advisor của bean {@code openAiChatClient} trong
 * {@code ChatModelConfig} — bean DUY NHẤT còn lại, và là bean mà mọi lời gọi LLM đi qua
 * {@code ChatClient} đều dùng (lập kế hoạch, định tuyến ý định, sinh câu gợi ý, gợi ý KPI).
 *
 * <p><b>Nó KHÔNG bao được vòng lặp agent.</b> Từ khi ứng dụng tự sở hữu vòng lặp, đường đó gọi
 * thẳng {@code OpenAiChatModel} chứ không qua {@code ChatClient}, nên không advisor nào chạy —
 * việc ghi token ở đó nằm trong {@code ModelGateway.recordUsage}. Sửa một bên mà quên bên kia là
 * để lọt một nửa số lượt tiêu token, tức đi vòng qua toàn bộ hạn mức.
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

    /**
     * Bản trước chỉ chuyển tiếp mà KHÔNG ghi gì, nên mọi lượt streaming tiêu token mà không để lại
     * dấu vết — tức đi vòng qua toàn bộ hạn mức. Đây là lỗ hổng hạn mức, không phải chuyện thẩm mỹ.
     *
     * <p>Ghi MỘT lần khi luồng kết thúc, dùng {@code Usage} thấy sau cùng: Spring AI cộng dồn usage
     * qua các vòng gọi tool, nên chunk cuối mang số đầy đủ cho cả lượt.
     *
     * <p><b>Phải mang ngữ cảnh sang thủ công.</b> Callback kết thúc luồng có thể chạy trên luồng của
     * scheduler, trong khi {@code record(...)} đọc {@code SecurityContextHolder} và tính năng đang
     * ghi nhận — cả hai đều là ThreadLocal. Không chép sang thì bản ghi hoặc bị bỏ qua vì "không xác
     * định được người dùng", hoặc ghi thiếu tính năng.
     */
    @Override
    public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest,
                                                 StreamAdvisorChain streamAdvisorChain) {
        SecurityContext callerContext = SecurityContextHolder.getContext();
        AiTokenUsage.AiFeature callerFeature = AiTokenUsageRecorder.currentFeature();
        AtomicReference<ChatClientResponse> last = new AtomicReference<>();

        return streamAdvisorChain.nextStream(chatClientRequest)
                .doOnNext(response -> {
                    if (usageOf(response) != null) last.set(response);
                })
                .doFinally(signal -> recordWithCallerContext(last.get(), callerContext, callerFeature));
    }

    /** Đặt lại ngữ cảnh của luồng gọi rồi ghi, xong trả nguyên trạng cho luồng đang mượn. */
    private void recordWithCallerContext(ChatClientResponse response,
                                         SecurityContext context,
                                         AiTokenUsage.AiFeature feature) {
        if (response == null) return;
        SecurityContext previousContext = SecurityContextHolder.getContext();
        AiTokenUsage.AiFeature previousFeature = AiTokenUsageRecorder.currentFeature();
        try {
            SecurityContextHolder.setContext(context);
            if (feature != null) AiTokenUsageRecorder.setFeature(feature);
            record(response);
        } finally {
            SecurityContextHolder.setContext(previousContext);
            if (previousFeature != null) {
                AiTokenUsageRecorder.setFeature(previousFeature);
            } else {
                AiTokenUsageRecorder.clearFeature();
            }
        }
    }

    private static Usage usageOf(ChatClientResponse response) {
        if (response == null) return null;
        ChatResponse chatResponse = response.chatResponse();
        if (chatResponse == null || chatResponse.getMetadata() == null) return null;
        return chatResponse.getMetadata().getUsage();
    }
}
