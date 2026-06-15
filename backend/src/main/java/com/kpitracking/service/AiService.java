package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.FollowupContextStore;
import com.kpitracking.tool.OrgUnitStatisticTool;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class AiService {

    private final ChatClient chatClient;
    private final ChatClient chatClientWithMemory;
    private final ManagerContextResolver managerContextResolver;
    private final OrgUnitStatisticTool orgUnitStatisticTool;
    private final DisambiguationGuard disambiguationGuard;
    private final FollowupContextStore followupContextStore;

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    @Value("classpath:/promptTemplates/topicGuardPrompt.st")
    private Resource topicGuardPrompt;

    private final ObjectMapper objectMapper;

    public AiService(@Qualifier("openAiChatClient") ChatClient chatClient,
                     @Qualifier("chatClientWithMemory") ChatClient chatClientWithMemory,
                     ManagerContextResolver managerContextResolver,
                     OrgUnitStatisticTool orgUnitStatisticTool,
                     DisambiguationGuard disambiguationGuard,
                     FollowupContextStore followupContextStore,
                     ObjectMapper objectMapper) {
        this.chatClient = chatClient;
        this.chatClientWithMemory = chatClientWithMemory;
        this.managerContextResolver = managerContextResolver;
        this.orgUnitStatisticTool = orgUnitStatisticTool;
        this.disambiguationGuard = disambiguationGuard;
        this.followupContextStore = followupContextStore;
        this.objectMapper = objectMapper;
    }

    public String processOrgUnitChat(String question, String conversationId) {
        ManagerContext ctx = managerContextResolver.resolve();
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
            // Reset this conversation's tool-result bucket so the follow-up generator
            // grounds questions only on THIS turn's tool outputs.
            followupContextStore.startTurn(conversationId);
        }

        try {
            String result;
            if (hasMemory) {
                result = chatClientWithMemory.prompt()
                        .user(question)
                        .system(orgUnitSystemPrompt)
                        .tools(orgUnitStatisticTool)
                        .toolContext(toolCtx)
                        .advisors(spec -> spec.param("chat_memory_conversation_id", conversationId))
                        .call()
                        .content();
            } else {
                result = chatClient.prompt()
                        .user(question)
                        .system(orgUnitSystemPrompt)
                        .tools(orgUnitStatisticTool)
                        .toolContext(toolCtx)
                        .call()
                        .content();
            }
            return sanitizeResponse(result);
        } catch (Exception e) {
            if (isQuotaError(e)) {
                throw new AiQuotaExceededException("quota exceeded", e);
            }
            throw e;
        } finally {
            disambiguationGuard.clear();
        }
    }

    public List<AiKpiSuggestionResponse> suggestKpis(UUID orgUnitId) {
        ManagerContext ctx = managerContextResolver.resolve();
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

            // Strip HTML <br> tags from JSON string values before parsing
            String sanitized = responseText.replaceAll("(?i)<br\\s*/?>", " / ").strip();
            return parseResponse(sanitized);
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

    private String sanitizeResponse(String result) {
        if (result == null) return "";
        // Handle <br> contextually: inside table cells use separator, outside use newline
        String[] lines = result.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].stripLeading().startsWith("|")) {
                // Inside a table row: replace <br> with separator to avoid breaking GFM table parsing
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", " / ");
            } else {
                // Outside table: convert <br> to newline for readability
                lines[i] = lines[i].replaceAll("(?i)<br\\s*/?>", "\n");
            }
        }
        result = String.join("\n", lines);
        // Collapse blank lines between table rows so multiline cells don't break GFM table parsing
        result = result.replaceAll("(?m)(\\|[^\\n]+)\\n{2,}(?=\\|)", "$1\n");
        return result.strip();
    }

    private boolean isQuotaError(Exception e) {
        String msg = collectMessages(e).toLowerCase();
        return msg.contains("429") || msg.contains("quota") || msg.contains("rate limit")
                || msg.contains("payment required") || msg.contains("402") || msg.contains("exceeded");
    }

    private String collectMessages(Throwable t) {
        StringBuilder sb = new StringBuilder();
        while (t != null) {
            if (t.getMessage() != null) {
                sb.append(t.getMessage()).append(" ");
            }
            t = t.getCause();
        }
        return sb.toString();
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
