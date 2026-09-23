package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SubmitKpisRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Gửi duyệt các chỉ tiêu KPI còn ở trạng thái NHÁP — việc đầu kỳ của trưởng đơn vị.
 *
 * <p>Cùng khuôn với {@link KpiCriteriaReviewTool}: tool chỉ dựng lời mời, {@code PendingActionExecutor}
 * mới gọi {@code bulkSubmitForApproval} khi người dùng bấm xác nhận. Hai luật của dịch vụ được kiểm
 * TRƯỚC khi mời, vì mời rồi mới hỏng là loại trải nghiệm tệ nhất:
 * <ul>
 *   <li>tổng trọng số của đơn vị trong kỳ phải đúng 100 % — không đủ thì nói thẳng thiếu/thừa bao
 *       nhiêu và chỉ sang {@code get_kpi(view=weights)};</li>
 *   <li>chỉ NGƯỜI TẠO mới gửi được chỉ tiêu của mình (dịch vụ lặng lẽ bỏ qua bản của người khác) —
 *       tool tách riêng những bản đó và báo số lượng, không để chúng biến mất trong im lặng.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class KpiSubmitTool {

    private static final int FETCH_LIMIT = 100;

    private final KpiCriteriaService kpiCriteriaService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "submit_kpis_for_approval", value =
            "GỬI DUYỆT các chỉ tiêu KPI đang ở trạng thái NHÁP (DRAFT) của một đơn vị trong một kỳ — việc "
            + "đầu kỳ của trưởng đơn vị ('gửi duyệt KPI', 'trình duyệt chỉ tiêu'). Đây là thao tác GHI: tool chỉ "
            + "chuẩn bị danh sách và chờ người dùng bấm xác nhận, KHÔNG tự thực hiện. "
            + "Thu hẹp bằng unitName, periodName, hoặc kpiName để gửi MỘT chỉ tiêu. "
            + "Tool sẽ báo nếu tổng trọng số của đơn vị chưa đúng 100 % (điều kiện bắt buộc để gửi duyệt). "
            + "KHÁC review_kpi_criteria: tool đó DUYỆT chỉ tiêu người khác đã gửi; tool này GỬI chỉ tiêu mình tạo.")
    public String submitKpis(SubmitKpisRequest request, InvocationParameters context) {
        try {
            UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (unit.clarification() != null) {
                return support.respond(context, "submit_kpis_for_approval", unit.clarification());
            }
            UUID periodId = support.resolvePeriodId(request.periodName(), context);
            if (periodId == null) {
                throw new IllegalArgumentException("Không xác định được kỳ KPI. Truyền periodName (vd 'Tháng 6/2026').");
            }

            PageResponse<KpiCriteriaResponse> page = kpiCriteriaService.getKpiCriteria(
                    0, FETCH_LIMIT, KpiStatus.DRAFT, unit.id(), null, null, periodId,
                    null, null, null, "createdAt", "asc", null, null, null, false, null, null, null, null);

            // Không dùng String.valueOf(context.get(...)): get() là generic nên Java chọn nhầm bản valueOf(char[]).
            Object rawUser = context.get("userId");
            UUID me = rawUser == null ? null : UUID.fromString(rawUser.toString());
            String wanted = ToolSupport.notBlank(request.kpiName()) ? request.kpiName().trim().toLowerCase(Locale.ROOT) : null;
            List<Item> items = new ArrayList<>();
            List<String> notMine = new ArrayList<>();
            for (KpiCriteriaResponse k : page.getContent()) {
                if (wanted != null && (k.getName() == null || !k.getName().toLowerCase(Locale.ROOT).contains(wanted))) continue;
                if (me != null && k.getCreatedById() != null && !me.equals(k.getCreatedById())) {
                    notMine.add(k.getName() + " (" + k.getCreatedByName() + " tạo)");
                    continue;
                }
                items.add(new Item(k.getId(), null, k.getName(), detailOf(k)));
            }

            if (items.isEmpty()) {
                Map<String, Object> out = new java.util.LinkedHashMap<>();
                out.put("nothingToDo", true);
                out.put("message", notMine.isEmpty()
                        ? "Không có chỉ tiêu NHÁP nào khớp yêu cầu trong đơn vị/kỳ này."
                        : "Không có chỉ tiêu nháp nào do bạn tạo; " + notMine.size()
                                + " chỉ tiêu nháp do người khác tạo — chỉ người tạo mới gửi duyệt được: " + notMine);
                out.put("guidance", "Nói với người dùng như trên. ĐỪNG mời họ xác nhận và ĐỪNG nói đã gửi.");
                return support.respond(context, "submit_kpis_for_approval", out);
            }

            // Luật tổng trọng số của dịch vụ — kiểm trước để không mời xác nhận một việc chắc chắn hỏng.
            Double total = kpiCriteriaService.calculateTotalWeightByOrgUnit(unit.id(), periodId);
            double weight = total == null ? 0 : total;
            if (Math.abs(weight - 100.0) > 0.001) {
                double gap = Math.round((100 - weight) * 100.0) / 100.0;
                return support.respond(context, "submit_kpis_for_approval", Map.of(
                        "blocked", true,
                        "totalWeight", weight,
                        "message", "Chưa gửi duyệt được: tổng trọng số KPI của đơn vị trong kỳ này là " + weight
                                + " %, " + (gap > 0 ? "THIẾU " + gap : "THỪA " + (-gap)) + " % so với 100 %.",
                        "guidance", "Nói rõ con số cho người dùng và gợi ý xem get_kpi(view=weights) rồi chỉnh trọng số. "
                                + "ĐỪNG mời xác nhận."));
            }

            String title = "Gửi duyệt " + items.size() + " chỉ tiêu KPI" + suffix(request.unitName(), request.periodName());
            String proposal = actions.propose(context, "submit_kpis_for_approval", Kind.KPI_SUBMIT, title,
                    Decision.APPROVE, null, items);
            if (!notMine.isEmpty()) {
                // Kèm phần bị bỏ qua vào chính payload trả cho model, để câu trả lời nói đủ hai vế.
                proposal = proposal.replaceFirst("\\{",
                        "{\"skippedNotCreatedByYou\":" + toJsonArray(notMine) + ",");
            }
            return proposal;
        } catch (Exception e) {
            return support.toolError("submit_kpis_for_approval", e);
        }
    }

    private static String detailOf(KpiCriteriaResponse k) {
        StringBuilder sb = new StringBuilder();
        if (k.getWeight() != null) sb.append("trọng số ").append(k.getWeight()).append(" %");
        if (k.getTargetValue() != null) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append("mục tiêu ").append(k.getTargetValue());
        }
        if (k.getOrgUnitName() != null) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append(k.getOrgUnitName());
        }
        return sb.toString();
    }

    private static String suffix(String unitName, String periodName) {
        StringBuilder sb = new StringBuilder();
        if (ToolSupport.notBlank(unitName)) sb.append(" của ").append(unitName.trim());
        if (ToolSupport.notBlank(periodName)) sb.append(", kỳ ").append(periodName.trim());
        return sb.toString();
    }

    private static String toJsonArray(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append('"').append(values.get(i).replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
        }
        return sb.append(']').toString();
    }
}
