package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ReviewKpiCriteriaRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.tool.ActionToolSupport.*;

/**
 * Duyệt hoặc từ chối chỉ tiêu KPI đang chờ phê duyệt.
 *
 * <p><b>Tool này KHÔNG ghi gì</b> — nó dựng lời mời xác nhận rồi dừng; việc ghi do
 * {@code PendingActionExecutor} làm sau khi người dùng bấm. Xem {@code PendingAction}.
 *
 * <p>Là bean RIÊNG chứ không gộp với các tool ghi khác: mỗi việc đòi một quyền khác nhau, mà
 * {@code ToolCallbacks.from(bean)} lấy mọi {@code @Tool} của một bean cùng lúc.
 */
@Component
@RequiredArgsConstructor
public class KpiCriteriaReviewTool {

    /** Lấy rộng hơn trần hiển thị để {@code ActionSupport} còn báo được "nhiều quá, thu hẹp lại". */
    private static final int FETCH_LIMIT = 100;

    private final KpiCriteriaService kpiCriteriaService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "review_kpi_criteria", description =
            "Duyệt hoặc TỪ CHỐI các chỉ tiêu KPI đang chờ phê duyệt. Đây là thao tác GHI: tool chỉ "
            + "chuẩn bị danh sách và chờ người dùng bấm xác nhận, KHÔNG tự thực hiện. "
            + "decision=APPROVE hoặc REJECT (từ chối thì PHẢI có note nêu lý do). "
            + "Thu hẹp bằng unitName và periodName. Chỉ lấy chỉ tiêu đang CHỜ DUYỆT. "
            + "Đây là chỉ tiêu (KPI criteria), KHÁC bài nộp — duyệt bài nộp thì dùng review_submissions.")
    public String reviewKpiCriteria(ReviewKpiCriteriaRequest request, ToolContext context) {
        try {
            Decision decision = decisionOf(request.decision());
            requireNoteWhenRejecting(decision, request.note(), "chỉ tiêu");

            UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (unit.clarification() != null) {
                return support.respond(context, "review_kpi_criteria", unit.clarification());
            }
            UUID periodId = support.resolvePeriodId(request.periodName(), context);

            PageResponse<KpiCriteriaResponse> page = kpiCriteriaService.getKpiCriteria(
                    0, FETCH_LIMIT, KpiStatus.PENDING_APPROVAL, unit.id(), null, null, periodId,
                    null, null, null, "createdAt", "asc", null, null, null, true, null, null, null, null);

            List<Item> items = page.getContent().stream()
                    .map(k -> new Item(k.getId(), null,
                            k.getName(),
                            detailOf(k)))
                    .toList();

            return actions.propose(context, "review_kpi_criteria", Kind.KPI_CRITERIA_REVIEW,
                    verb(decision) + " " + items.size() + " chỉ tiêu KPI"
                            + suffix(request.unitName(), request.periodName()),
                    decision, request.note(), items);
        } catch (Exception e) {
            return support.toolError("review_kpi_criteria", e);
        }
    }

    /** Trọng số và mục tiêu là hai thứ người duyệt nhìn trước tiên. */
    private static String detailOf(KpiCriteriaResponse k) {
        StringBuilder sb = new StringBuilder();
        if (k.getWeight() != null) sb.append("trọng số ").append(trim(k.getWeight()));
        if (k.getTargetValue() != null) {
            if (sb.length() > 0) sb.append(", ");
            sb.append("mục tiêu ").append(trim(k.getTargetValue()));
            if (ToolSupport.notBlank(k.getUnit())) sb.append(' ').append(k.getUnit());
        }
        return sb.toString();
    }

}
