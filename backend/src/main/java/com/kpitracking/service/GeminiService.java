package com.kpitracking.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.genai.Client;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class GeminiService {

    private final String apiKey;
    private final String model;
    private final OrgUnitRepository orgUnitRepository;
    private final ObjectMapper objectMapper;
    private final Client client;

    public GeminiService(
            @Value("${gemini.api.key}") String apiKey,
            @Value("${gemini.api.model}") String model,
            OrgUnitRepository orgUnitRepository,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey;
        this.model = model;
        this.orgUnitRepository = orgUnitRepository;
        this.objectMapper = objectMapper;
        
        // Initialize the Gen AI Client
        this.client = Client.builder()
                .apiKey(apiKey)
                .build();
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

        String prompt = String.format(
            "Bạn là một chuyên gia tư vấn quản trị KPI chuyên nghiệp. Hãy gợi ý danh sách 3-5 chỉ tiêu KPI phù hợp cho %s.\n" +
            "Bối cảnh bổ sung: %s\n" +
            "Yêu cầu trả về DUY NHẤT một mảng JSON các đối tượng có cấu trúc:\n" +
            "[\n" +
            "  {\n" +
            "    \"name\": \"Tên chỉ tiêu\",\n" +
            "    \"description\": \"Mô tả chi tiết\",\n" +
            "    \"unit\": \"Đơn vị tính\",\n" +
            "    \"targetValue\": 100.0,\n" +
            "    \"weight\": 20.0,\n" +
            "    \"frequency\": \"MONTHLY\"\n" +
            "  }\n" +
            "]\n" +
            "Lưu ý quan trọng: Hãy đưa ra con số targetValue THỰC TẾ và PHÙ HỢP với %s dựa trên kinh nghiệm quản trị. " +
            "Các giá trị frequency chỉ được dùng: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY.",
            orgInfo, 
            (context != null && !context.isEmpty()) ? context : "Thiết lập chỉ tiêu hoạt động định kỳ",
            orgInfo
        );

        try {
            // Use the SDK as per the requested pattern
            GenerateContentConfig config = GenerateContentConfig.builder()
                    .temperature(0.1f)
                    .build();

            GenerateContentResponse response = client.models.generateContent(model, prompt, config);
            
            String responseText = response.text();
            log.debug("AI Response: {}", responseText);
            
            return parseResponse(responseText);
            
        } catch (Exception e) {
            log.error("Error calling Gemini via SDK: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    private List<AiKpiSuggestionResponse> parseResponse(String text) {
        try {
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
