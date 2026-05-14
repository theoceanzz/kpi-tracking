package com.kpitracking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class GeminiService {

    private final ChatClient chatClient;
    private final OrgUnitRepository orgUnitRepository;
    private final ObjectMapper objectMapper;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource systemPrompt;

    public GeminiService(
            @Qualifier("geminiChatClient") ChatClient chatClient,
            OrgUnitRepository orgUnitRepository,
            ObjectMapper objectMapper) {
        this.chatClient = chatClient;
        this.orgUnitRepository = orgUnitRepository;
        this.objectMapper = objectMapper;
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<AiKpiSuggestionResponse> getKpiSuggestions(UUID orgUnitId, String context) {
        OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                .orElse(null);

        String orgInfo = "";
        if (orgUnit != null) {
            String unitType = "Phòng ban";
            try {
                unitType = orgUnit.getOrgHierarchyLevel().getUnitTypeName();
            } catch (Exception e) {
                // Ignore lazy loading issues
            }
            orgInfo = String.format("Đơn vị: %s (Loại: %s)", orgUnit.getName(), unitType);
        } else {
            orgInfo = "Đơn vị: Tổng công ty";
        }

        String userPrompt = String.format(
            "Hãy gợi ý danh sách 3-5 chỉ tiêu KPI phù hợp cho %s.\n" +
            "Bối cảnh bổ sung: %s\n" +
            "Lưu ý quan trọng: Hãy đưa ra con số targetValue THỰC TẾ và PHÙ HỢP với %s dựa trên kinh nghiệm quản trị.",
            orgInfo, 
            (context != null && !context.isEmpty()) ? context : "Thiết lập chỉ tiêu hoạt động định kỳ",
            orgInfo
        );

        try {
            String responseText = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userPrompt)
                    .call()
                    .content();
            
            log.debug("AI Response: {}", responseText);
            
            return parseResponse(responseText);
            
        } catch (Exception e) {
            log.error("Error calling Gemini via ChatClient: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    private List<AiKpiSuggestionResponse> parseResponse(String text) {
        try {
            if (text == null) return new ArrayList<>();
            String jsonText = text.trim();
            if (jsonText.contains("```")) {
                int start = Math.min(
                    jsonText.indexOf("[") != -1 ? jsonText.indexOf("[") : Integer.MAX_VALUE,
                    jsonText.indexOf("{") != -1 ? jsonText.indexOf("{") : Integer.MAX_VALUE
                );
                int end = Math.max(
                    jsonText.lastIndexOf("]"),
                    jsonText.lastIndexOf("}")
                );
                if (start != Integer.MAX_VALUE && end != -1 && end > start) {
                    jsonText = jsonText.substring(start, end + 1);
                }
            }
            return objectMapper.readValue(jsonText, objectMapper.getTypeFactory().constructCollectionType(List.class, AiKpiSuggestionResponse.class));
        } catch (Exception e) {
            log.error("Error parsing AI response to JSON: {}. Content: {}", e.getMessage(), text);
            return new ArrayList<>();
        }
    }
}
