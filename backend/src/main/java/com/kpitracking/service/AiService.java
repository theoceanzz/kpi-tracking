package com.kpitracking.service;

import com.kpitracking.entity.Organization;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.service.ManagerContextResolver.ManagerContext;
import com.kpitracking.service.ai.AiTurn;
import com.kpitracking.ai.workflow.KeyGoAssistant;
import com.kpitracking.exception.AiQuotaExceededException;
import com.kpitracking.exception.AiRateLimitException;
import com.kpitracking.exception.AiTokenQuotaExceededException;
import org.springframework.security.core.context.SecurityContextHolder;
import com.kpitracking.util.AiUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;


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
    private final ManagerContextResolver managerContextResolver;
    private final OrganizationRepository organizationRepository;
    private final AiRateLimiter aiRateLimiter;
    private final AiQuotaService aiQuotaService;

    public AiService(KeyGoAssistant assistant,
                     ManagerContextResolver managerContextResolver,
                     OrganizationRepository organizationRepository,
                     AiRateLimiter aiRateLimiter,
                     AiQuotaService aiQuotaService) {
        this.assistant = assistant;
        this.managerContextResolver = managerContextResolver;
        this.organizationRepository = organizationRepository;
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

}
