package com.kpitracking.ai.config;

import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiTokenUsageRecorder;
import dev.langchain4j.model.chat.listener.ChatModelErrorContext;
import dev.langchain4j.model.chat.listener.ChatModelListener;
import dev.langchain4j.model.chat.listener.ChatModelRequestContext;
import dev.langchain4j.model.chat.listener.ChatModelResponseContext;
import dev.langchain4j.model.output.TokenUsage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Ghi token đã tiêu của MỌI lời gọi model qua langchain4j.
 *
 * <p>Thay cho {@code TokenUsageAuditAdvisor} (chỉ bắt được đường {@code ChatClient}) và
 * {@code ModelGateway.recordUsage} (chỉ bắt đường vòng lặp agent) — hai chỗ ghi cho hai đường,
 * sửa một bên quên bên kia là lọt nửa số lượt. Ở đây gắn thẳng vào {@code ChatModel} nên mọi agent,
 * mọi đường, cùng đi qua một chỗ.
 *
 * <p><b>Bắt người dùng ở {@code onRequest}, ghi ở {@code onResponse}.</b> Với model streaming,
 * {@code onResponse} chạy trên luồng HTTP client — không có {@code SecurityContextHolder}, không có
 * tính năng đang ghi nhận. {@code onRequest} thì chạy trên luồng gọi, nên chép hai thứ đó vào
 * {@code attributes()} (map dùng chung cho một lời gọi) rồi đọc lại ở {@code onResponse}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TokenUsageListener implements ChatModelListener {

    private static final String ATTR_USER = "kg.user";
    private static final String ATTR_FEATURE = "kg.feature";

    private final AiTokenUsageRecorder recorder;

    @Override
    public void onRequest(ChatModelRequestContext ctx) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null) ctx.attributes().put(ATTR_USER, auth.getName());
        AiTokenUsage.AiFeature feature = AiTokenUsageRecorder.currentFeature();
        if (feature != null) ctx.attributes().put(ATTR_FEATURE, feature);
    }

    @Override
    public void onResponse(ChatModelResponseContext ctx) {
        try {
            TokenUsage usage = ctx.chatResponse().tokenUsage();
            if (usage == null) return;
            log.info("Token usage details: {}", usage);

            String model = ctx.chatResponse().modelName();
            Object user = ctx.attributes().get(ATTR_USER);
            Object feature = ctx.attributes().get(ATTR_FEATURE);
            recorder.record(user == null ? null : user.toString(),
                    feature instanceof AiTokenUsage.AiFeature f ? f : null,
                    model, safe(usage.inputTokenCount()), safe(usage.outputTokenCount()),
                    safe(usage.totalTokenCount()));
        } catch (Exception e) {
            // Không để việc ghi nhận làm hỏng câu trả lời đã có sẵn cho người dùng.
            log.error("Không ghi được tiêu thụ token: {}", e.getMessage(), e);
        }
    }

    @Override
    public void onError(ChatModelErrorContext ctx) {
        log.warn("Lời gọi model lỗi: {}", ctx.error().getMessage());
    }

    private static int safe(Integer v) {
        return v == null ? 0 : v;
    }
}
