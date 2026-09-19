package com.kpitracking.ai.agent.help;

import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.reward.RewardContext;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Cửa vào của hỏi đáp về KeyGo: kiểm hạn mức, gắn tổ chức, gọi {@link HelpAgent}.
 *
 * <p>Ở Pha 0 nó đứng một mình sau endpoint {@code /ai/help}; sang Pha 1 nó thành nhánh
 * {@code HELP} của workflow chung — phần gọi agent giữ nguyên, chỉ bỏ endpoint riêng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HelpService {

    public record Answer(String text) {}

    private final HelpAgent helpAgent;
    private final RewardContext currentUser;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;

    public Answer ask(String question) {
        String email = currentUser.getCurrentUser().getEmail();
        aiRateLimiter.check(email);
        aiQuotaService.checkAndThrow(email);

        UUID orgId = currentUser.getCurrentOrgId();
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.HELP);
        try {
            return new Answer(helpAgent.answer(question,
                    InvocationParameters.from(HelpAgentFactory.PARAM_ORG_ID, orgId.toString())));
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }
}
