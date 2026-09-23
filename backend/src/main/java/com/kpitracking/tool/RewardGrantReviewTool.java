package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.reward.RewardGrantResponse;
import com.kpitracking.enums.RewardGrantStatus;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.service.reward.RewardGrantService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ReviewRewardGrantsRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

import static com.kpitracking.tool.ActionToolSupport.decisionOf;
import static com.kpitracking.tool.ActionToolSupport.requireNoteWhenRejecting;

/**
 * Duyệt / từ chối đề xuất thưởng điểm đang chờ — cùng khuôn với {@link KpiCriteriaReviewTool}.
 * Chỉ có khi tổ chức bật {@code enableReward}; quyền {@code REWARD:APPROVE} kiểm ở {@code ToolRegistry}.
 */
@Component
@RequiredArgsConstructor
public class RewardGrantReviewTool {

    private static final int FETCH_LIMIT = 50;

    private final RewardGrantService grantService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "review_reward_grants", value =
            "Duyệt hoặc TỪ CHỐI các đề xuất THƯỞNG ĐIỂM đang chờ duyệt. Đây là thao tác GHI: tool chỉ "
            + "chuẩn bị danh sách và chờ người dùng bấm xác nhận, KHÔNG tự thực hiện. "
            + "decision=APPROVE hoặc REJECT (từ chối thì PHẢI có note nêu lý do). "
            + "Thu hẹp bằng unitName hoặc grantorName (người đề nghị). Chỉ lấy đề xuất đang CHỜ DUYỆT.")
    public String reviewRewardGrants(ReviewRewardGrantsRequest request, InvocationParameters context) {
        try {
            Decision decision = decisionOf(request.decision());
            requireNoteWhenRejecting(decision, request.note(), "đề xuất thưởng");

            String unitName = null;
            if (ToolSupport.notBlank(request.unitName()) || ToolSupport.notBlank(request.unitId())) {
                ToolSupport.UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                if (u.clarification() != null) return support.respond(context, "review_reward_grants", u.clarification());
                unitName = ToolSupport.notBlank(request.unitName()) ? request.unitName().trim().toLowerCase(Locale.ROOT) : null;
            }
            final String unitFilter = unitName;
            final String grantorFilter = ToolSupport.notBlank(request.grantorName())
                    ? request.grantorName().trim().toLowerCase(Locale.ROOT) : null;

            PageResponse<RewardGrantResponse> page = grantService.search(RewardGrantStatus.PENDING_APPROVAL, null, 0, FETCH_LIMIT);
            List<Item> items = page.getContent().stream()
                    .filter(g -> unitFilter == null || (g.getOrgUnitName() != null
                            && g.getOrgUnitName().toLowerCase(Locale.ROOT).contains(unitFilter)))
                    .filter(g -> grantorFilter == null || (g.getGrantorName() != null
                            && g.getGrantorName().toLowerCase(Locale.ROOT).contains(grantorFilter)))
                    .map(g -> new Item(g.getId(), null,
                            g.getGrantorName() + " đề nghị thưởng " + recipientsOf(g),
                            g.getTotalPoints() + " điểm" + (g.getReason() != null ? " · " + g.getReason() : "")))
                    .toList();

            String verb = decision == Decision.REJECT ? "Từ chối" : "Duyệt";
            return actions.propose(context, "review_reward_grants", Kind.REWARD_GRANT_REVIEW,
                    verb + " " + items.size() + " đề xuất thưởng", decision, request.note(), items);
        } catch (Exception e) {
            return support.toolError("review_reward_grants", e);
        }
    }

    private static String recipientsOf(RewardGrantResponse g) {
        if (g.getRecipients() == null || g.getRecipients().isEmpty()) return "(chưa rõ người nhận)";
        List<String> names = g.getRecipients().stream().map(RewardGrantResponse.Recipient::getFullName).toList();
        return names.size() <= 3 ? String.join(", ", names) : names.get(0) + ", " + names.get(1) + " +" + (names.size() - 2) + " người";
    }
}
