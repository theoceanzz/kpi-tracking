package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.AiTurnPipeline;
import com.kpitracking.tool.DisambiguationGuard;
import com.kpitracking.tool.EscapeHatchTool;
import com.kpitracking.tool.ToolRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hai tính năng AI của hệ thống.
 *
 * <p>Luồng chat đã chuyển sang {@link AiTurnPipeline}: từng công đoạn là một
 * {@code AiStage} riêng, nên thêm công đoạn mới (bộ nhớ đệm, lập kế hoạch, kiểm duyệt câu trả lời)
 * chỉ là thêm một lớp — không phải sửa lớp này.
 */
@Service
@Slf4j
public class AiService {

    private final AiTurnPipeline aiTurnPipeline;
    private final ManagerContextResolver managerContextResolver;
    private final OrganizationRepository organizationRepository;
    private final ToolRegistry toolRegistry;
    private final DisambiguationGuard disambiguationGuard;
    private final ChatClient chatClient;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    // Constructor viết tay chứ KHÔNG dùng @RequiredArgsConstructor: dự án không có lombok.config
    // khai báo @Qualifier là annotation được sao chép, nên Lombok sẽ bỏ qua nó và Spring gặp hai
    // bean ChatClient (openAiChatClient, chatClientWithMemory) rồi báo mơ hồ lúc khởi động.
    public AiService(AiTurnPipeline aiTurnPipeline,
                     ManagerContextResolver managerContextResolver,
                     OrganizationRepository organizationRepository,
                     ToolRegistry toolRegistry,
                     DisambiguationGuard disambiguationGuard,
                     @Qualifier("openAiChatClient") ChatClient chatClient) {
        this.aiTurnPipeline = aiTurnPipeline;
        this.managerContextResolver = managerContextResolver;
        this.organizationRepository = organizationRepository;
        this.toolRegistry = toolRegistry;
        this.disambiguationGuard = disambiguationGuard;
        this.chatClient = chatClient;
    }

    /**
     * Một lượt hỏi AI. Toàn bộ các bước — chặn tần suất, kiểm quyền, dựng ngữ cảnh, định tuyến,
     * gọi model, phục hồi lỗi — nằm trong chuỗi {@link AiTurnPipeline}.
     */
    public String processOrgUnitChat(String question, String conversationId, String focusUnitId) {
        return aiTurnPipeline.run(new AiTurn(question, conversationId, focusUnitId));
    }

    /**
     * Gợi ý KPI. Chưa dùng pipeline vì luồng khác hẳn: một lời gọi duy nhất, trả về dữ liệu có
     * cấu trúc chứ không phải câu trả lời cho người đọc, và không có bộ nhớ hội thoại.
     */
    public List<AiKpiSuggestionResponse> suggestKpis(UUID orgUnitId) {
        ManagerContext ctx = managerContextResolver.resolve();
        if (ctx == null) {
            log.warn("User without manager/deputy role attempted to use suggestKpis");
            return new ArrayList<>();
        }
        // Luôn dùng đơn vị của chính quản lý để chặn truy cập chéo đơn vị
        orgUnitId = ctx.orgUnitId();

        Organization org = organizationRepository.findById(ctx.orgId()).orElse(null);
        if (org == null || Boolean.FALSE.equals(org.getEnableAi())) {
            throw new ForbiddenException("Tính năng AI đã bị tắt cho tổ chức của bạn.");
        }

        log.info("Suggesting KPIs for orgUnitId: {}", orgUnitId);

        String userPrompt = "Dựa trên dữ liệu thống kê hiện tại của đơn vị, hãy phân tích các điểm yếu, "
                + "cơ hội và gợi ý 3-5 KPI phù hợp nhất để cải thiện hiệu suất trong kỳ tới.";

        try {
            return chatClient.prompt()
                    .system(kpiSuggestionSystemPrompt)
                    .user(userPrompt)
                    .tools(toolRegistry.toolsFor(toolRegistry.readGroups(), ctx.userId()).toArray())
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
            EscapeHatchTool.clear();
        }
    }
}
