package com.kpitracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.ai.FollowupRequest;
import com.kpitracking.dto.response.ai.FollowupResponse;
import com.kpitracking.tool.FollowupContextStore;
import com.kpitracking.tool.FollowupContextStore.ToolResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Generates the follow-up question pools shown after the chatbot answers.
 *
 * <p>Grounding: instead of the (truncated) natural-language answer, we read the actual
 * structured tool outputs of the just-finished chat turn from {@link FollowupContextStore}
 * (keyed by conversationId) and feed those to the LLM. The prompt derives notes then
 * questions in a single call and is forbidden from inventing numbers. If there is no tool
 * data (model answered without tools, or expired cache) we fall back to fixed templates.
 */
@Service
@Slf4j
public class FollowupService {

    private static final int MAX_CHARS_PER_TOOL = 1200;
    private static final int MAX_TOTAL_CHARS = 4000;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final FollowupContextStore followupContextStore;

    @Value("classpath:/promptTemplates/followupSuggestionsPrompt.st")
    private Resource followupPrompt;

    public FollowupService(@Qualifier("openAiChatClient") ChatClient chatClient,
                           ObjectMapper objectMapper,
                           FollowupContextStore followupContextStore) {
        this.chatClient = chatClient;
        this.objectMapper = objectMapper;
        this.followupContextStore = followupContextStore;
    }

    public FollowupResponse generate(FollowupRequest request) {
        String conversationId = request != null ? request.getConversationId() : null;
        String question = request != null ? request.getContext() : null;

        // If the model is asking user to disambiguate, suppress follow-up questions
        // until they make a selection.
        if (followupContextStore.isDisambiguating(conversationId)) {
            return FollowupResponse.builder()
                    .technical(List.of())
                    .management(List.of())
                    .build();
        }

        List<ToolResult> toolData = followupContextStore.get(conversationId);
        if (toolData.isEmpty()) {
            // No grounded data this turn → fixed templates (never break the UI).
            return fixedTemplates();
        }

        String dataContext = buildDataContext(toolData, question);
        try {
            String raw = chatClient.prompt()
                    .system(followupPrompt)
                    .user(dataContext)
                    .call()
                    .content();
            FollowupResponse parsed = parse(raw);
            if (parsed != null
                    && parsed.getTechnical() != null && !parsed.getTechnical().isEmpty()
                    && parsed.getManagement() != null && !parsed.getManagement().isEmpty()) {
                return parsed;
            }
            log.warn("Followup AI response missing pools, using fixed templates. Raw: {}", raw);
        } catch (Exception e) {
            log.warn("Followup generation failed, using fixed templates: {}", e.getMessage());
        }
        return fixedTemplates();
    }

    /** Compact, bounded rendering of the turn's tool outputs (+ the user's question for focus). */
    private String buildDataContext(List<ToolResult> toolData, String question) {
        StringBuilder sb = new StringBuilder();
        if (question != null && !question.isBlank()) {
            sb.append("Câu hỏi của người dùng: ").append(question.trim()).append("\n\n");
        }
        sb.append("DỮ LIỆU TỪ CÔNG CỤ (chỉ dùng đúng tên/số trong đây):\n");
        for (ToolResult tr : toolData) {
            if (sb.length() >= MAX_TOTAL_CHARS) break;
            String json = tr.getJson() == null ? "" : tr.getJson();
            if (json.length() > MAX_CHARS_PER_TOOL) {
                json = json.substring(0, MAX_CHARS_PER_TOOL) + "…";
            }
            sb.append("- ").append(tr.getToolName()).append(": ").append(json).append("\n");
        }
        return sb.toString();
    }

    private FollowupResponse parse(String text) {
        if (text == null) return null;
        try {
            String json = text.trim();
            int start = json.indexOf('{');
            int end = json.lastIndexOf('}');
            if (start >= 0 && end > start) {
                json = json.substring(start, end + 1);
            }
            JsonNode node = objectMapper.readTree(json);
            return FollowupResponse.builder()
                    .technical(readArray(node.get("technical")))
                    .management(readArray(node.get("management")))
                    .build();
        } catch (Exception e) {
            log.warn("Could not parse followup JSON: {}. Content: {}", e.getMessage(), text);
            return null;
        }
    }

    private List<String> readArray(JsonNode arr) {
        List<String> out = new ArrayList<>();
        if (arr != null && arr.isArray()) {
            arr.forEach(n -> {
                String s = n.asText(null);
                if (s != null && !s.isBlank()) out.add(s.trim());
            });
        }
        return out;
    }

    private FollowupResponse fixedTemplates() {
        return FollowupResponse.builder()
                .technical(List.of(
                        "Nguyên nhân chính của kết quả này là gì?",
                        "Chỉ số nào kéo hiệu suất xuống nhiều nhất?",
                        "Xu hướng thay đổi qua các kỳ ra sao?",
                        "KPI nào đang chậm tiến độ nhất?",
                        "So sánh kỳ này với kỳ trước thế nào?"
                ))
                .management(List.of(
                        "Ai chịu trách nhiệm cho kết quả này?",
                        "Cần ra quyết định gì để cải thiện?",
                        "Đơn vị nào cần hỗ trợ thêm nguồn lực?",
                        "So sánh các đơn vị với nhau thế nào?",
                        "Hành động ưu tiên trong tuần tới là gì?"
                ))
                .build();
    }
}
