package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardBudgetResponse;
import com.kpitracking.dto.response.reward.RewardGrantResponse;
import com.kpitracking.enums.RewardGrantStatus;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.reward.RewardBudgetService;
import com.kpitracking.service.reward.RewardGrantService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.RewardRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Thưởng điểm: đề xuất đang chờ duyệt, đợt thưởng đã phát, ngân sách của người hỏi.
 *
 * <p>Chỉ có mặt khi tổ chức bật {@code enableReward}. Dữ liệu lấy đúng qua các dịch vụ mà REST
 * dùng ({@code search}, {@code getMyActiveBudget}) — chúng tự thu về tổ chức và tự kiểm quyền; tool
 * lọc thêm theo đơn vị nếu người dùng nêu tên. Ngân sách là của CHÍNH người hỏi (người cấp thưởng),
 * không xem được ngân sách của người khác.
 */
@Component
@RequiredArgsConstructor
public class RewardTool {

    private static final int FETCH_LIMIT = 50;

    private final RewardGrantService grantService;
    private final RewardBudgetService budgetService;
    private final PermissionChecker permissionChecker;
    private final ToolSupport support;

    @Tool(name = "get_rewards", value = "THƯỞNG ĐIỂM. "
            + "view=pending (mặc định): các đề xuất thưởng đang CHỜ DUYỆT (ai đề nghị, thưởng ai, bao nhiêu điểm, lý do). "
            + "view=granted: các đợt thưởng ĐÃ PHÁT gần đây — 'ai được thưởng kỳ này'. "
            + "view=budget: ngân sách thưởng CỦA CHÍNH BẠN — được cấp, đã dùng, còn lại, mức tối đa mỗi lần. "
            + "unitName để thu hẹp theo đơn vị. Duyệt/từ chối đề xuất thì dùng review_reward_grants.")
    public String getRewards(RewardRequest request, InvocationParameters context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) throw new IllegalArgumentException("Sai view. Chỉ nhận: pending, granted, budget.");

            Object response = switch (view) {
                case "budget" -> budget(context);
                case "granted" -> grants(RewardGrantStatus.APPROVED, request, context);
                default -> grants(RewardGrantStatus.PENDING_APPROVAL, request, context);
            };
            return support.respond(context, "get_rewards", response);
        } catch (Exception e) {
            return support.toolError("get_rewards", e);
        }
    }

    private Object budget(InvocationParameters context) {
        Object rawUser = context.get("userId");
        UUID me = rawUser == null ? null : UUID.fromString(rawUser.toString());
        if (me == null || !permissionChecker.hasPermission(me, "REWARD:GRANT")) {
            throw new ForbiddenException("Bạn không có quyền cấp thưởng nên không có ngân sách thưởng để xem.");
        }
        RewardBudgetResponse b = budgetService.getMyActiveBudget();
        if (b == null) {
            return Map.of("message", "Bạn chưa được cấp ngân sách thưởng nào đang hiệu lực.");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cycleName", b.getKpiCycleName());
        out.put("periodName", b.getKpiPeriodName());
        out.put("periodStart", b.getPeriodStart() != null ? b.getPeriodStart().toString() : null);
        out.put("periodEnd", b.getPeriodEnd() != null ? b.getPeriodEnd().toString() : null);
        out.put("allocatedPoints", b.getAllocatedPoints());
        out.put("usedPoints", b.getUsedPoints());
        out.put("remainingPoints", b.getRemainingPoints());
        out.put("maxPerAward", b.getMaxPerAward());
        out.put("note", b.getNote());
        return out;
    }

    private Object grants(RewardGrantStatus status, RewardRequest request, InvocationParameters context) {
        String unitFilter = null;
        if (ToolSupport.notBlank(request.unitName()) || ToolSupport.notBlank(request.unitId())) {
            ToolSupport.UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return u.clarification();
            unitFilter = ToolSupport.notBlank(request.unitName()) ? request.unitName().trim().toLowerCase(Locale.ROOT) : null;
        }
        PageResponse<RewardGrantResponse> page = grantService.search(status, null, 0, FETCH_LIMIT);
        List<RewardGrantResponse> grants = page.getContent();
        if (unitFilter != null) {
            String wanted = unitFilter;
            grants = grants.stream().filter(g -> g.getOrgUnitName() != null
                    && g.getOrgUnitName().toLowerCase(Locale.ROOT).contains(wanted)).toList();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", status.name());
        out.put("count", grants.size());
        out.put("grants", grants.stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", g.getId());
            m.put("grantorName", g.getGrantorName());
            m.put("orgUnitName", g.getOrgUnitName());
            m.put("totalPoints", g.getTotalPoints());
            m.put("pointsPerRecipient", g.getPointsPerRecipient());
            m.put("reason", g.getReason());
            m.put("recipients", g.getRecipients() == null ? List.of()
                    : g.getRecipients().stream().map(RewardGrantResponse.Recipient::getFullName).toList());
            m.put("createdAt", g.getCreatedAt() != null ? g.getCreatedAt().toString() : null);
            return m;
        }).toList());
        if (grants.isEmpty()) {
            out.put("message", status == RewardGrantStatus.PENDING_APPROVAL
                    ? "Không có đề xuất thưởng nào đang chờ duyệt." : "Chưa có đợt thưởng nào được phát trong phạm vi này.");
        }
        return out;
    }

    private static String normalizeView(String raw) {
        if (raw == null || raw.isBlank()) return "pending";
        String s = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (s) {
            case "pending", "pending_approval", "waiting", "proposals" -> "pending";
            case "granted", "approved", "awarded", "history" -> "granted";
            case "budget", "my_budget", "quota" -> "budget";
            default -> null;
        };
    }
}
