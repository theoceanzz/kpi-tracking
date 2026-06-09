package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.tool.DisambiguationGuard;
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
    private final OrgUnitStatisticTool orgUnitStatisticTool;
    private final DisambiguationGuard disambiguationGuard;

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    @Value("classpath:/promptTemplates/topicGuardPrompt.st")
    private Resource topicGuardPrompt;

    private final ObjectMapper objectMapper;

    public AiService(@Qualifier("openAiChatClient") ChatClient chatClient,
                     @Qualifier("chatClientWithMemory") ChatClient chatClientWithMemory,
                     UserRepository userRepository,
                     UserRoleOrgUnitRepository userRoleOrgUnitRepository,
                     OrgUnitStatisticTool orgUnitStatisticTool,
                     DisambiguationGuard disambiguationGuard,
                     ObjectMapper objectMapper) {
        this.chatClient = chatClient;
        this.chatClientWithMemory = chatClientWithMemory;
        this.userRepository = userRepository;
        this.userRoleOrgUnitRepository = userRoleOrgUnitRepository;
        this.orgUnitStatisticTool = orgUnitStatisticTool;
        this.disambiguationGuard = disambiguationGuard;
        this.objectMapper = objectMapper;
    }

    public String processOrgUnitChat(String question, String conversationId) {
        ManagerContext ctx = getCurrentUserManagerContext();
        if (ctx == null) {
            return "Bạn không có quyền sử dụng tính năng AI phân tích. Chỉ trưởng đơn vị hoặc phó đơn vị mới có thể truy cập tính năng này.";
        }

        if (!isInScope(question)) {
            return "Xin lỗi, tôi là trợ lý phân tích KPI của hệ thống và chỉ hỗ trợ các câu hỏi liên quan đến "
                    + "KPI, hiệu suất, đơn vị và nhân sự. Bạn vui lòng đặt câu hỏi thuộc nghiệp vụ này nhé.";
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

    /**
     * Lightweight topic guard: classifies whether the user's message belongs to the
     * KPI business domain before invoking the (tool-heavy) main model. Lenient by
     * design — short follow-ups/selections count as in-scope, and any classifier
     * error fails open so legitimate KPI questions are never wrongly blocked.
     */
    private boolean isInScope(String question) {
        if (question == null || question.isBlank()) return true;
        try {
            String verdict = chatClient.prompt()
                    .system(topicGuardPrompt)
                    .user(question)
                    .call()
                    .content();
            if (verdict == null) return true;
            String v = verdict.trim().toUpperCase();
            // Block only on an explicit NO; anything else is treated as in-scope.
            boolean outOfScope = v.startsWith("NO") || v.equals("NO.") || v.contains("\"NO\"");
            if (outOfScope) {
                log.info("Topic guard rejected out-of-scope message: {}", question);
            }
            return !outOfScope;
        } catch (Exception e) {
            log.warn("Topic guard classification failed, allowing message through: {}", e.getMessage());
            return true;
        }
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
}
