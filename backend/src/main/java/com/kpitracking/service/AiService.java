package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.OrgStatisticTool;
import com.kpitracking.tool.OrgUnitStatisticTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class AiService {

    private final ChatClient chatClient;
    private final ChatClient chatClientWithMemory;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgStatisticTool orgStatisticTool;
    private final OrgUnitStatisticTool orgUnitStatisticTool;
    private final DisambiguationGuard disambiguationGuard;

    @Value("classpath:/promptTemplates/orgToolSystemPromptTemplate.st")
    Resource orgSystemPrompt;

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    private final ObjectMapper objectMapper;

    public AiService(@Qualifier("openAiChatClient") ChatClient chatClient,
                     @Qualifier("chatClientWithMemory") ChatClient chatClientWithMemory,
                     UserRepository userRepository,
                     UserRoleOrgUnitRepository userRoleOrgUnitRepository,
                     OrgStatisticTool orgStatisticTool,
                     OrgUnitStatisticTool orgUnitStatisticTool,
                     DisambiguationGuard disambiguationGuard,
                     ObjectMapper objectMapper) {
        this.chatClient = chatClient;
        this.chatClientWithMemory = chatClientWithMemory;
        this.userRepository = userRepository;
        this.userRoleOrgUnitRepository = userRoleOrgUnitRepository;
        this.orgStatisticTool = orgStatisticTool;
        this.orgUnitStatisticTool = orgUnitStatisticTool;
        this.disambiguationGuard = disambiguationGuard;
        this.objectMapper = objectMapper;
    }

    public String processOrgChat(String question) {
        UUID orgId = getCurrentUserOrgId();
        if(orgId == null) return  null;
        log.info("Processing chat for orgId: {}", orgId);

        return chatClient.prompt()
                .user(question)
                .system(orgSystemPrompt)
                .tools(orgStatisticTool)
                .toolContext(Map.of("organizationId", orgId))
                .call()
                .content();
    }

    public String processOrgUnitChat(String question, String conversationId) {
        ManagerContext ctx = getCurrentUserManagerContext();
        if (ctx == null) {
            return "Bạn không có quyền sử dụng tính năng AI phân tích. Chỉ trưởng đơn vị hoặc phó đơn vị mới có thể truy cập tính năng này.";
        }

        boolean hasMemory = conversationId != null && !conversationId.isBlank();
        log.info("Processing chat for orgUnitId: {}, conversationId: {}", ctx.orgUnitId(), hasMemory ? conversationId : "none");

        Map<String, Object> toolCtx = new HashMap<>();
        toolCtx.put("orgUnitId", ctx.orgUnitId());
        toolCtx.put("orgUnitPath", ctx.orgUnitPath());
        toolCtx.put("organizationId", ctx.orgId());
        if (hasMemory) {
            toolCtx.put("conversationId", conversationId);
        }

        try {
            if (hasMemory) {
                return chatClientWithMemory.prompt()
                        .user(question)
                        .system(orgUnitSystemPrompt)
                        .tools(orgUnitStatisticTool)
                        .toolContext(toolCtx)
                        .advisors(spec -> spec.param("chat_memory_conversation_id", conversationId))
                        .call()
                        .content();
            }

            return chatClient.prompt()
                    .user(question)
                    .system(orgUnitSystemPrompt)
                    .tools(orgUnitStatisticTool)
                    .toolContext(toolCtx)
                    .call()
                    .content();
        } finally {
            disambiguationGuard.clear();
        }
    }

    public List<AiKpiSuggestionResponse> suggestKpis(UUID orgUnitId) {
        ManagerContext ctx = getCurrentUserManagerContext();
        if (ctx == null) {
            log.warn("User without manager/deputy role attempted to use suggestKpis");
            return new ArrayList<>();
        }
        // Always use manager's own unit to prevent cross-unit access
        orgUnitId = ctx.orgUnitId();

        log.info("Suggesting KPIs for orgUnitId: {}", orgUnitId);

        String userPrompt = "Dựa trên dữ liệu thống kê hiện tại của đơn vị, hãy phân tích các điểm yếu, cơ hội và gợi ý 3-5 KPI phù hợp nhất để cải thiện hiệu suất trong kỳ tới.";

        try {
            String responseText = chatClient.prompt()
                    .system(kpiSuggestionSystemPrompt)
                    .user(userPrompt)
                    .tools(orgUnitStatisticTool)
                    .toolContext(Map.of(
                            "orgUnitId", orgUnitId,
                            "orgUnitPath", ctx.orgUnitPath(),
                            "organizationId", ctx.orgId()
                    ))
                    .call()
                    .content();

            log.debug("KPI Suggestion AI Response: {}", responseText);

            return parseResponse(responseText);
        } catch (Exception e) {
            log.error("Error suggesting KPIs: {}", e.getMessage(), e);
            return new ArrayList<>();
        } finally {
            disambiguationGuard.clear();
        }
    }

    public String chatWithMemory(String message, String conversationId) {
        if (conversationId == null || conversationId.isBlank()) {
            log.info("Processing stateless chat (no conversationId)");
            return chatClient.prompt().user(message).call().content();
        }
        log.info("Processing memory chat for conversationId: {}", conversationId);
        return chatClientWithMemory.prompt()
                .user(message)
                .advisors(spec -> spec.param("chat_memory_conversation_id", conversationId))
                .call()
                .content();
    }

    private record ManagerContext(UUID orgUnitId, String orgUnitPath, UUID orgId) {}

    private ManagerContext getCurrentUserManagerContext() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            return assignments.stream()
                    .filter(a -> a.getRole().getRank() != null && a.getRole().getRank() <= 1)
                    .min(Comparator.comparingInt(a -> a.getRole().getRank()))
                    .map(a -> new ManagerContext(
                            a.getOrgUnit().getId(),
                            a.getOrgUnit().getPath(),
                            a.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId()
                    ))
                    .orElse(null);
        } catch (Exception e) {
            log.error("Error getting manager context", e);
            return null;
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

    private UUID getCurrentUserOrgId() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) return null;

            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(user.getId());
            if (assignments.isEmpty()) return null;

            // Get organization ID from the first assignment
            return assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
        } catch (Exception e) {
            log.error("Error getting current user org ID", e);
            return null;
        }
    }
}
