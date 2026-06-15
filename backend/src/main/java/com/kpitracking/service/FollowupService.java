package com.kpitracking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.ai.FollowupRequest;
import com.kpitracking.dto.response.ai.FollowupResponse;
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
 * Turn 0 → fixed templates (no AI). Turn ≥1 → LLM generates 10 questions
 * (5 technical + 5 management). Any AI/parse failure falls back to fixed templates,
 * so the chat never loses its suggestion buttons.
 */
@Service
@Slf4j
public class FollowupService {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;

    @Value("classpath:/promptTemplates/followupSuggestionsPrompt.st")
    private Resource followupPrompt;

    public FollowupService(@Qualifier("openAiChatClient") ChatClient chatClient,
                           ObjectMapper objectMapper) {
        this.chatClient = chatClient;
        this.objectMapper = objectMapper;
    }

    public FollowupResponse generate(FollowupRequest request) {
        int turn = request != null && request.getTurn() != null ? request.getTurn() : 0;
        String context = request != null ? request.getContext() : null;

        if (turn <= 0 || context == null || context.isBlank()) {
            return fixedTemplates();
        }

        try {
            String raw = chatClient.prompt()
                    .system(followupPrompt)
                    .user(context)
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
