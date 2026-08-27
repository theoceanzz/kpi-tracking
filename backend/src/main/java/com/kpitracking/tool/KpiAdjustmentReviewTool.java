package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.AdjustmentRequestResponse;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.service.KpiAdjustmentService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ReviewAdjustmentsRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.tool.ActionToolSupport.*;

/**
 * Duyệt hoặc từ chối yêu cầu ĐIỀU CHỈNH chỉ tiêu KPI.
 *
 * <p><b>Tool này KHÔNG ghi gì</b> — nó dựng lời mời xác nhận rồi dừng; việc ghi do
 * {@code PendingActionExecutor} làm sau khi người dùng bấm. Xem {@code PendingAction}.
 *
 * <p>Là bean RIÊNG chứ không gộp với các tool ghi khác: mỗi việc đòi một quyền khác nhau, mà
 * {@code ToolCallbacks.from(bean)} lấy mọi {@code @Tool} của một bean cùng lúc.
 */
@Component
@RequiredArgsConstructor
public class KpiAdjustmentReviewTool {

    /** Lấy rộng hơn trần hiển thị để {@code ActionSupport} còn báo được "nhiều quá, thu hẹp lại". */
    private static final int FETCH_LIMIT = 100;

    private final KpiAdjustmentService adjustmentService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "review_kpi_adjustments", description =
            "Duyệt hoặc TỪ CHỐI các yêu cầu ĐIỀU CHỈNH chỉ tiêu KPI đang chờ. Đây là thao tác GHI: "
            + "tool chỉ chuẩn bị danh sách và chờ người dùng bấm xác nhận, KHÔNG tự thực hiện. "
            + "decision=APPROVE hoặc REJECT (từ chối thì PHẢI có note nêu lý do). "
            + "Thu hẹp bằng unitName và periodName. "
            + "Dùng khi người dùng nói về yêu cầu xin đổi mục tiêu / xin giảm chỉ tiêu.")
    public String reviewAdjustments(ReviewAdjustmentsRequest request, ToolContext context) {
        try {
            Decision decision = decisionOf(request.decision());
            requireNoteWhenRejecting(decision, request.note(), "yêu cầu điều chỉnh");

            UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (unit.clarification() != null) {
                return support.respond(context, "review_kpi_adjustments", unit.clarification());
            }
            UUID periodId = support.resolvePeriodId(request.periodName(), context);

            PageResponse<AdjustmentRequestResponse> page = adjustmentService.getAllRequests(
                    0, FETCH_LIMIT, AdjustmentStatus.PENDING, unit.id(), periodId);

            List<Item> items = page.getContent().stream()
                    .map(a -> new Item(a.getId(), null,
                            nameOr(a.getRequesterName()) + " — " + a.getKpiCriteriaName(),
                            adjustmentDetail(a)))
                    .toList();

            return actions.propose(context, "review_kpi_adjustments", Kind.KPI_ADJUSTMENT_REVIEW,
                    verb(decision) + " " + items.size() + " yêu cầu điều chỉnh"
                            + suffix(request.unitName(), request.periodName()),
                    decision, request.note(), items);
        } catch (Exception e) {
            return support.toolError("review_kpi_adjustments", e);
        }
    }

    /** Nêu ĐỔI TỪ ĐÂU SANG ĐÂU — không có vế đó thì người duyệt không thẩm định được gì. */
    private static String adjustmentDetail(AdjustmentRequestResponse a) {
        if (a.isDeactivationRequest()) return "xin ngừng áp dụng chỉ tiêu";
        StringBuilder sb = new StringBuilder();
        if (a.getCurrentTargetValue() != null && a.getRequestedTargetValue() != null) {
            sb.append("mục tiêu ").append(trim(a.getCurrentTargetValue()))
              .append(" → ").append(trim(a.getRequestedTargetValue()));
        }
        if (ToolSupport.notBlank(a.getReason())) {
            if (sb.length() > 0) sb.append("; ");
            sb.append("lý do: ").append(a.getReason());
        }
        return sb.toString();
    }

}
