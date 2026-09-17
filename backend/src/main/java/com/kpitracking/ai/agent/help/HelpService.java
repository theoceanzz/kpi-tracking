package com.kpitracking.ai.agent.help;

import com.kpitracking.ai.rag.RagIngestionService;
import com.kpitracking.entity.AiTokenUsage;
import com.kpitracking.service.AiQuotaService;
import com.kpitracking.service.AiRateLimiter;
import com.kpitracking.service.AiTokenUsageRecorder;
import com.kpitracking.service.reward.RewardContext;
import dev.langchain4j.invocation.InvocationParameters;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.service.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cửa vào của hỏi đáp về KeyGo: kiểm hạn mức, gắn tổ chức, gọi {@link HelpAgent}, gom nguồn.
 *
 * <p>Ở Pha 0 nó đứng một mình sau endpoint {@code /ai/help}; sang Pha 1 nó thành nhánh
 * {@code HELP} của workflow chung — phần gọi agent giữ nguyên, chỉ bỏ endpoint riêng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HelpService {

    public record Source(String title, String parent, String route, List<String> images, List<String> captions) {}

    public record Answer(String text, List<Source> sources) {}

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
            Result<String> result = helpAgent.answer(question,
                    InvocationParameters.from(HelpAgentFactory.PARAM_ORG_ID, orgId.toString()));
            return new Answer(result.content(), sourcesOf(result.sources()));
        } finally {
            AiTokenUsageRecorder.clearFeature();
        }
    }

    /**
     * Gom nguồn theo MỤC, không theo đoạn: một mục dài cắt thành ba đoạn thì người dùng thấy một
     * dòng "Nguồn", không phải ba dòng giống hệt nhau.
     */
    public static List<Source> sourcesOf(List<Content> contents) {
        Map<String, Source> byTitle = new LinkedHashMap<>();
        for (Content c : contents) {
            var m = c.textSegment().metadata();
            String key = m.getString("parent") + "›" + m.getString("title");
            byTitle.computeIfAbsent(key, k -> new Source(
                    m.getString("title"), m.getString("parent"), m.getString("route"),
                    split(m.getString("images")), split(m.getString("captions"))));
        }
        return new ArrayList<>(byTitle.values());
    }

    private static List<String> split(String joined) {
        if (joined == null || joined.isBlank()) return List.of();
        return Arrays.stream(joined.split(java.util.regex.Pattern.quote(RagIngestionService.SEP))).toList();
    }
}
