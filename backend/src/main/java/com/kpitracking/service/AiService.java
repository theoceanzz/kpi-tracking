package com.kpitracking.service;

import com.kpitracking.advisor.ResponseSanitizingAdvisor;
import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.FollowupContextStore;
import com.kpitracking.tool.OrgUnitStatisticTool;
import com.kpitracking.util.AiUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    /**
     * Names of every @Tool exposed to the chat model, collected once via reflection so the
     * response sanitizer can strip any leaked tool name without maintaining a duplicate list.
     */
    private static final Set<String> TOOL_NAMES = collectToolNames(OrgUnitStatisticTool.class);

    private static Set<String> collectToolNames(Class<?> toolClass) {
        Set<String> names = new LinkedHashSet<>();
        for (Method m : toolClass.getDeclaredMethods()) {
            org.springframework.ai.tool.annotation.Tool tool =
                    m.getAnnotation(org.springframework.ai.tool.annotation.Tool.class);
            if (tool == null) continue;
            String name = tool.name() != null && !tool.name().isBlank() ? tool.name() : m.getName();
            names.add(name);
        }
        return names;
    }

    @Value("classpath:/promptTemplates/orgUnitToolSystemPromptTemplate.st")
    Resource orgUnitSystemPrompt;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    @Value("classpath:/promptTemplates/topicGuardPrompt.st")
    private Resource topicGuardPrompt;

    public AiService(@Qualifier("openAiChatClient") ChatClient chatClient,
                     @Qualifier("chatClientWithMemory") ChatClient chatClientWithMemory,
                     ManagerContextResolver managerContextResolver,
                     OrgUnitStatisticTool orgUnitStatisticTool,
                     DisambiguationGuard disambiguationGuard,
                     FollowupContextStore followupContextStore) {
        this.chatClient = chatClient;
        this.chatClientWithMemory = chatClientWithMemory;
        this.managerContextResolver = managerContextResolver;
        this.orgUnitStatisticTool = orgUnitStatisticTool;
        this.disambiguationGuard = disambiguationGuard;
        this.followupContextStore = followupContextStore;
    }

    public String processOrgUnitChat(String question, String conversationId) {
        ManagerContext ctx = managerContextResolver.resolve();
        if (ctx == null) {
            return "Bạn không có quyền sử dụng tính năng AI phân tích. Chỉ trưởng đơn vị hoặc phó đơn vị mới có thể truy cập tính năng này.";
        }

        boolean hasMemory = conversationId != null && !conversationId.isBlank();
        // Reset this conversation's tool-result bucket at the very start of the turn so the
        // follow-up generator grounds only on THIS turn's tool outputs. Done before the scope
        // check so refusals/clarifications cannot inherit the previous turn's data (which would
        // wrongly produce follow-up chips).
        if (hasMemory) {
            followupContextStore.startTurn(conversationId);
        }

        if (!isInScope(question)) {
            return "Xin lỗi, tôi là trợ lý phân tích KPI của hệ thống và chỉ hỗ trợ các câu hỏi liên quan đến "
                    + "KPI, hiệu suất, đơn vị và nhân sự. Bạn vui lòng đặt câu hỏi thuộc nghiệp vụ này nhé.";
        }

        log.info("Processing chat for orgUnitId: {}, conversationId: {}", ctx.orgUnitId(), hasMemory ? conversationId : "none");

        Map<String, Object> toolCtx = new HashMap<>();
        toolCtx.put("orgUnitId", ctx.orgUnitId());
        toolCtx.put("orgUnitPath", ctx.orgUnitPath());
        toolCtx.put("organizationId", ctx.orgId());
        toolCtx.put("userEmail", ctx.email());
        if (hasMemory) {
            toolCtx.put("conversationId", conversationId);
        }

        // Real current time (Vietnam, UTC+7) injected into the system prompt so the model never
        // guesses/hallucinates "now". Display form is dd/MM/yyyy; the ISO hint is for date-param math.
        java.time.ZonedDateTime now = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        String currentDateTime = now.format(java.time.format.DateTimeFormatter
                        .ofPattern("dd/MM/yyyy HH:mm 'ICT', EEEE", new java.util.Locale("vi")))
                + " (ISO: " + now.toLocalDate() + ")";

        try {
            String result;
            if (hasMemory) {
                result = chatClientWithMemory.prompt()
                        .user(question)
                        .system(s -> s.text(orgUnitSystemPrompt).param("currentDateTime", currentDateTime))
                        .tools(orgUnitStatisticTool)
                        .toolContext(toolCtx)
                        .advisors(spec -> spec.param("chat_memory_conversation_id", conversationId))
                        .advisors(new ResponseSanitizingAdvisor(TOOL_NAMES))
                        .call()
                        .content();
            } else {
                result = chatClient.prompt()
                        .user(question)
                        .system(s -> s.text(orgUnitSystemPrompt).param("currentDateTime", currentDateTime))
                        .tools(orgUnitStatisticTool)
                        .toolContext(toolCtx)
                        .advisors(new ResponseSanitizingAdvisor(TOOL_NAMES))
                        .call()
                        .content();
            }
            // Reasoning model (gpt-oss) đôi lúc tiêu hết token cho reasoning rồi chạm
            // finishReason=LENGTH trước khi kịp sinh text -> content rỗng. Không để lộ
            // bong bóng trống ra người dùng; trả câu gợi ý hỏi ngắn gọn hơn.
            if (result == null || result.isBlank()) {
                log.warn("AI trả nội dung rỗng (nghi finishReason=LENGTH/reasoning quá dài). question={}", question);
                return "Xin lỗi, mình chưa tạo được câu trả lời cho yêu cầu này (nội dung xử lý quá dài). "
                        + "Bạn thử hỏi ngắn gọn/cụ thể hơn giúp mình nhé.";
            }
            return result;
        } catch (Exception e) {
            if (AiUtils.isQuotaError(e)) {
                throw new AiQuotaExceededException("quota exceeded", e);
            }
            // Lỗi từ model/nhà cung cấp (vd gpt-oss trên groq trả HTTP 400 "output_parse_failed"
            // khi câu quá phức tạp / vòng gọi tool sinh output không parse được) -> KHÔNG ném ra
            // ngoài thành "lỗi không xác định"; log để chẩn đoán và trả câu thân thiện, gợi ý hỏi gọn hơn.
            log.error("Chat AI thất bại (question='{}'): {}", question, e.getMessage(), e);
            return "Xin lỗi, mình gặp trục trặc khi xử lý yêu cầu này (có thể do câu hỏi khá phức tạp). "
                    + "Bạn thử hỏi ngắn gọn/cụ thể hơn — ví dụ nêu rõ tên các phòng/đơn vị cần so sánh — giúp mình nhé.";
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
            return chatClient.prompt()
                    .system(kpiSuggestionSystemPrompt)
                    .user(userPrompt)
                    .tools(orgUnitStatisticTool)
                    .toolContext(Map.of(
                            "orgUnitId", orgUnitId,
                            "orgUnitPath", ctx.orgUnitPath(),
                            "organizationId", ctx.orgId()
                    ))
                    .call()
                    .entity(new ParameterizedTypeReference<>() {});
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

}
