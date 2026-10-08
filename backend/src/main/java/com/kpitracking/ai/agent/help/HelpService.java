package com.kpitracking.ai.agent.help;

import com.kpitracking.dto.response.ai.DocumentSourceResponse;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.reward.RewardContext;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.service.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
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

    public record Answer(String text, List<DocumentSourceResponse> sources) {}

    /** Tài liệu của tổ chức trong các đoạn đã truy hồi — mỗi tài liệu một lần, bỏ bộ hướng dẫn chung. */
    public static List<DocumentSourceResponse> sourcesOf(Result<?> result) {
        if (result == null || result.sources() == null) return List.of();
        java.util.Map<String, DocumentSourceResponse> byDoc = new java.util.LinkedHashMap<>();
        for (Content c : result.sources()) {
            DocumentSourceResponse s = c.textSegment() == null ? null
                    : DocumentSourceResponse.fromMetadata(c.textSegment().metadata());
            if (s != null) byDoc.putIfAbsent(s.docId(), s);
        }
        return List.copyOf(byDoc.values());
    }

    private final HelpAgent helpAgent;
    private final RewardContext currentUser;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;

    public Answer ask(String question) {
        String email = currentUser.getCurrentUser().getEmail();
        aiRateLimiter.check(email);
        aiQuotaService.checkAndThrow(email);

        UUID orgId = currentUser.getCurrentOrgId();
        UUID userId = currentUser.getCurrentUser().getId();
        AiTokenUsageRecorder.setFeature(AiTokenUsage.AiFeature.HELP);
        try {
            String language = com.kpitracking.i18n.ErrorMessages.currentLocale().getLanguage();
            Result<String> result = helpAgent.answer(com.kpitracking.ai.agent.AiLanguage.prefix(language) + question,
                    HelpAgentFactory.params(orgId, userId));
            return new Answer(result.content(), sourcesOf(result));
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }
}
