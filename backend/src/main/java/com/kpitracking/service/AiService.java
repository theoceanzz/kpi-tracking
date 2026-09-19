package com.kpitracking.service;

import com.kpitracking.dto.response.ai.AiKpiSuggestionResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.ai.agent.KpiSuggestionAgent;
import com.kpitracking.ai.agent.KpiSuggestionRag;
import com.kpitracking.ai.workflow.KeyGoAssistant;
import com.kpitracking.exception.AiRateLimitException;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import com.kpitracking.service.ai.agent.AgentState;
import dev.langchain4j.invocation.InvocationParameters;
import org.springframework.security.core.context.SecurityContextHolder;
import com.kpitracking.tool.ToolRegistry;
import com.kpitracking.util.AiUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hai tính năng AI của hệ thống.
 *
 * <p>Luồng chat đã chuyển sang {@code KeyGoAssistant}: từng công đoạn là một
 * bước của đồ thị riêng, nên thêm công đoạn mới (bộ nhớ đệm, lập kế hoạch, kiểm duyệt câu trả lời)
 * chỉ là thêm một lớp — không phải sửa lớp này.
 */
@Service
@Slf4j
public class AiService {

    private final KeyGoAssistant assistant;
    private final KpiSuggestionAgent kpiSuggestionAgent;
    private final ManagerContextResolver managerContextResolver;
    private final OrganizationRepository organizationRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final ToolRegistry toolRegistry;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;

    public AiService(KeyGoAssistant assistant,
                     KpiSuggestionAgent kpiSuggestionAgent,
                     ManagerContextResolver managerContextResolver,
                     OrganizationRepository organizationRepository,
                     OrgUnitRepository orgUnitRepository,
                     ToolRegistry toolRegistry,
                     AiRateLimiter aiRateLimiter,
                     AiQuotaService aiQuotaService) {
        this.assistant = assistant;
        this.kpiSuggestionAgent = kpiSuggestionAgent;
        this.managerContextResolver = managerContextResolver;
        this.organizationRepository = organizationRepository;
        this.orgUnitRepository = orgUnitRepository;
        this.toolRegistry = toolRegistry;
        this.aiRateLimiter = aiRateLimiter;
        this.aiQuotaService = aiQuotaService;
    }

    private static String currentUserEmail() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : null;
    }

    /**
     * Ba chốt chặn trước khi chạy workflow — {@code GuardStages} cũ. Là điều kiện tiên quyết của
     * lượt, không phải bước của đồ thị agent, nên nằm ở đây.
     *
     * @return câu trả lời cắt ngắn khi người dùng không có quyền dùng trợ lý, hoặc {@code null} nếu
     *         được đi tiếp
     */
    private String guard(AiTurn turn) {
        aiRateLimiter.check(currentUserEmail());
        aiQuotaService.checkAndThrow(currentUserEmail());
        ManagerContext ctx = managerContextResolver.resolve();
        if (ctx == null) {
            // Không phải trưởng/phó đơn vị nào -> lượt NHÂN VIÊN: chỉ dữ liệu của chính họ (nhóm PERSONAL).
            ctx = managerContextResolver.resolveMember();
            if (ctx == null) {
                return "Bạn chưa thuộc đơn vị nào trong tổ chức nên trợ lý chưa có dữ liệu để trả lời. "
                        + "Hãy liên hệ quản trị viên để được phân công.";
            }
            turn.setStaff(true);
        }
        Organization org = organizationRepository.findById(ctx.orgId()).orElse(null);
        if (org == null || Boolean.FALSE.equals(org.getEnableAi())) {
            throw new ForbiddenException("Tính năng AI đã bị tắt cho tổ chức của bạn.");
        }
        turn.setManager(ctx);
        turn.setFeatures(new AiTurn.OrgFeatures(
                Boolean.TRUE.equals(org.getEnableConduct()), Boolean.TRUE.equals(org.getEnableReward()),
                Boolean.TRUE.equals(org.getEnableWaterfall()), Boolean.TRUE.equals(org.getEnableBsc()),
                Boolean.TRUE.equals(org.getEnableOkr())));
        return null;
    }

    /**
     * Một lượt hỏi AI. Toàn bộ các bước — chặn tần suất, kiểm quyền, dựng ngữ cảnh, định tuyến,
     * gọi model, phục hồi lỗi — nằm trong chuỗi {@code KeyGoAssistant}.
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
        String refused = guard(turn);
        if (refused != null) return refused;
        try {
            return assistant.answer(turn);
        } catch (AiQuotaExceededException | AiTokenQuotaExceededException
                 | AiRateLimitException | ForbiddenException e) {
            throw e;
        } catch (Exception e) {
            if (AiUtils.isQuotaError(e)) throw new AiQuotaExceededException("quota exceeded", e);
            log.error("Chat AI thất bại (question='{}'): {}", turn.getQuestion(), e.getMessage(), e);
            return "Xin lỗi, mình gặp trục trặc khi xử lý yêu cầu này (có thể do câu hỏi khá phức tạp). "
                    + "Bạn thử hỏi ngắn gọn/cụ thể hơn — ví dụ nêu rõ tên các phòng/đơn vị cần so sánh — giúp mình nhé.";
        }
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

        // Tên đơn vị phải nằm trong prompt: không có thì model hỏi lại "đơn vị nào?" thay vì tra tool
        // (đo được ngay lượt đầu trên lõi mới — prompt hệ thống của agent này không có ngữ cảnh lượt).
        String unitName = orgUnitRepository.findById(orgUnitId).map(OrgUnit::getName).orElse(null);
        StringBuilder prompt = new StringBuilder();
        if (unitName != null) prompt.append("Đơn vị cần gợi ý: ").append(unitName).append(". ");
        prompt.append("Dựa trên dữ liệu thống kê hiện tại của đơn vị này (tra bằng tool), hãy phân tích các "
                + "điểm yếu, cơ hội và gợi ý 3-5 KPI phù hợp nhất để cải thiện hiệu suất trong kỳ tới.");
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
            // Dựng một lượt tối thiểu để dùng chung bộ lọc tool (KeyGoToolProvider đọc AgentState.turn).
            // Đường này không có lượt chat nào nhưng vẫn mượn tool, mà tool ghi trạng thái vào
            // AgentState. Thiếu nó thì chốt chặn tên trùng im lặng ngừng hoạt động ở riêng đường này.
            AiTurn turn = new AiTurn(userPrompt, null, null);
            turn.setManager(ctx);
            turn.setEffectiveUnitId(orgUnitId);
            turn.setToolGroups(toolRegistry.readGroups());
            AgentState state = new AgentState(turn);
            turn.setAgentState(state);
            Map<String, Object> paramMap = new HashMap<>(Map.of(
                    "orgUnitId", orgUnitId,
                    "orgUnitPath", ctx.orgUnitPath(),
                    "organizationId", ctx.orgId(),
                    "userId", ctx.userId(),
                    AgentState.CONTEXT_KEY, state));
            // Cho bộ truy hồi mô tả công việc/chiến lược (KpiSuggestionRag) biết đang gợi ý cho ai.
            if (unitName != null) paramMap.put(KpiSuggestionRag.PARAM_UNIT_NAME, unitName);
            if (context != null && !context.isBlank()) paramMap.put(KpiSuggestionRag.PARAM_CONTEXT, context.strip());
            String raw = kpiSuggestionAgent.suggest(turn.getTurnId(), userPrompt, InvocationParameters.from(paramMap));
            List<AiKpiSuggestionResponse> suggestions = KpiSuggestionAgent.parse(raw);
            if (suggestions.isEmpty()) {
                // Không có mảng JSON nào: model từ chối hoặc hỏi lại. Ghi lại để biết vì sao, thay vì
                // im lặng hiện "AI không tìm thấy gợi ý phù hợp".
                log.warn("Gợi ý KPI cho {}: model không trả mảng JSON. Trả lời: {}", orgUnitId,
                        raw == null ? null : raw.substring(0, Math.min(300, raw.length())));
            }
            return suggestions;
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
