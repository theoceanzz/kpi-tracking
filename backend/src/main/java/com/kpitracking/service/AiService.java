package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.AiTurnPipeline;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.util.AiUtils;
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
    private final ChatClient chatClient;

    @Value("classpath:/promptTemplates/kpiSuggestionSystemPrompt.st")
    private Resource kpiSuggestionSystemPrompt;

    // Constructor viết tay chứ KHÔNG dùng @RequiredArgsConstructor: dự án không có lombok.config
    // khai báo @Qualifier là annotation được sao chép, nên Lombok sẽ bỏ qua nó. Nay chỉ còn MỘT
    // bean ChatClient nên bỏ qualifier vẫn chạy, nhưng giữ lại để chỗ tiêm nói rõ nó cần bean nào —
    // thêm bean thứ hai sau này sẽ không âm thầm đổi thứ lớp này nhận được.
    public AiService(AiTurnPipeline aiTurnPipeline,
                     ManagerContextResolver managerContextResolver,
                     OrganizationRepository organizationRepository,
                     ToolRegistry toolRegistry,
                     @Qualifier("openAiChatClient") ChatClient chatClient) {
        this.aiTurnPipeline = aiTurnPipeline;
        this.managerContextResolver = managerContextResolver;
        this.organizationRepository = organizationRepository;
        this.toolRegistry = toolRegistry;
        this.chatClient = chatClient;
    }

    /**
     * Một lượt hỏi AI. Toàn bộ các bước — chặn tần suất, kiểm quyền, dựng ngữ cảnh, định tuyến,
     * gọi model, phục hồi lỗi — nằm trong chuỗi {@link AiTurnPipeline}.
     */
    public String processOrgUnitChat(String question, String conversationId, String focusUnitId) {
        return processOrgUnitChat(new AiTurn(question, conversationId, focusUnitId));
    }

    /**
     * Nhận thẳng ngữ cảnh lượt. Dùng khi lời gọi mang thêm thứ gì đó ngoài ba tham số cơ bản —
     * vd form đang mở trên màn hình. Nhận {@link AiTurn} thay vì nối dài danh sách tham số, đúng
     * lý do object ngữ cảnh này ra đời.
     */
    public String processOrgUnitChat(AiTurn turn) {
        return aiTurnPipeline.run(turn);
    }

    /**
     * Gợi ý KPI. Chưa dùng pipeline vì luồng khác hẳn: một lời gọi duy nhất, trả về dữ liệu có
     * cấu trúc chứ không phải câu trả lời cho người đọc, và không có bộ nhớ hội thoại.
     */
    public List<AiKpiSuggestionResponse> suggestKpis(UUID orgUnitId) {
        return suggestKpis(orgUnitId, null);
    }

    /**
     * Gợi ý KPI cho đơn vị.
     *
     * @param context mô tả bối cảnh người dùng đang soạn (tên chỉ tiêu đang gõ, loại KPI,
     *                đợt, mục tiêu liên quan). Có thì gợi ý bám sát việc họ đang làm thay vì
     *                lặp lại cùng một bộ chung chung mỗi lần bấm.
     */
    public List<AiKpiSuggestionResponse> suggestKpis(UUID orgUnitId, String context) {
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

        StringBuilder prompt = new StringBuilder(
                "Dựa trên dữ liệu thống kê hiện tại của đơn vị, hãy phân tích các điểm yếu, cơ hội "
                        + "và gợi ý 3-5 KPI phù hợp nhất để cải thiện hiệu suất trong kỳ tới.");
        if (context != null && !context.isBlank()) {
            // Cắt bớt phòng người dùng dán cả đoạn dài vào ô tên chỉ tiêu.
            String trimmed = context.strip();
            if (trimmed.length() > 500) trimmed = trimmed.substring(0, 500);
            prompt.append("\n\nNgười dùng đang soạn một chỉ tiêu với bối cảnh sau: \"")
                  .append(trimmed)
                  .append("\". Hãy ưu tiên các gợi ý bám sát bối cảnh này.");
        }
        String userPrompt = prompt.toString();

        try {
            return chatClient.prompt()
                    .system(kpiSuggestionSystemPrompt)
                    .user(userPrompt)
                    .tools(toolRegistry.toolsFor(toolRegistry.readGroups(), ctx.userId()).toArray())
                    .toolContext(Map.of(
                            "orgUnitId", orgUnitId,
                            "orgUnitPath", ctx.orgUnitPath(),
                            "organizationId", ctx.orgId(),
                            // Đường này không có lượt chat nào nhưng vẫn mượn tool, mà tool ghi
                            // trạng thái vào đây. Thiếu nó thì chốt chặn tên trùng im lặng ngừng
                            // hoạt động ở riêng đường gợi ý KPI.
                            AgentState.CONTEXT_KEY, AgentState.forToolsOnly()
                    ))
                    .call()
                    .entity(new ParameterizedTypeReference<>() {});
        } catch (Exception e) {
            log.error("Error suggesting KPIs: {}", e.getMessage(), e);
            // Hết credit / vượt giới hạn nhà cung cấp: ném ra để người dùng biết đúng lý do.
            // Nuốt thành danh sách rỗng sẽ hiện "AI không tìm thấy gợi ý phù hợp" — sai hoàn toàn
            // và không ai lần ra được là do tài khoản AI hết hạn mức.
            if (AiUtils.isQuotaError(e)) {
                throw new AiQuotaExceededException("quota exceeded", e);
            }
            throw new BusinessException(
                    "Không lấy được gợi ý từ AI lúc này. Vui lòng thử lại sau ít phút.");
        }
        // Không còn khối finally dọn ThreadLocal: trạng thái nay sống theo lời gọi (AgentState đặt
        // trong toolContext ở trên), nên hết lời gọi là nó tự đi — không thể rơi sang lượt của
        // người khác trên cùng luồng Tomcat.
    }
}
