package com.kpitracking.tool;

import com.kpitracking.dto.response.conduct.ConductSheetResponse;
import com.kpitracking.dto.response.conduct.ConductSummaryResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.enums.ConductScope;
import com.kpitracking.enums.ConductStatus;
import com.kpitracking.service.ConductService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ConductRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import com.kpitracking.tool.ToolSupport.UserRef;
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
 * KPI hành vi (hạnh kiểm): bảng điểm của một đơn vị hoặc phiếu của một người.
 *
 * <p>Chỉ có mặt khi tổ chức bật {@code enableConduct} (lọc ở {@code KeyGoToolProvider}). Phạm vi
 * đơn vị/người qua {@code resolveUnit/resolveUser}; dịch vụ còn kiểm thêm quyền chấm
 * ({@code canEvaluate}) với phiếu cá nhân, nên không có đường xem trộm.
 *
 * <p>Đối tượng chấm là ĐỢT (cycle) hoặc KỲ (period): người dùng nói tên kỳ thì theo kỳ, không thì
 * theo đợt đang diễn ra/gần nhất — cùng cách chọn với {@code get_cycle_evaluation}.
 */
@Component
@RequiredArgsConstructor
public class ConductTool {

    private final ConductService conductService;
    private final CycleEvaluationTool cycleEvaluationTool;
    private final ToolSupport support;

    @Tool(name = "get_conduct", value = "KPI HÀNH VI (hạnh kiểm). "
            + "view=summary (mặc định): bảng của một đơn vị — từng người: điểm tự chấm, điểm quản lý chấm, trạng thái "
            + "(chưa tự chấm / chờ quản lý / đã chấm); dùng cho 'ai chưa tự chấm', 'hạnh kiểm phòng tôi'. "
            + "view=sheet: PHIẾU của MỘT người (userName/userId) — từng tiêu chí, dẫn chứng, nhận xét. "
            + "periodName = theo KỲ KPI; bỏ trống = theo ĐỢT đánh giá đang diễn ra/gần nhất (cycleName để chọn đợt khác). "
            + "Mặc định là đơn vị hiện tại; người dùng nêu tên đơn vị thì PHẢI truyền unitName.")
    public String getConduct(ConductRequest request, InvocationParameters context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) throw new IllegalArgumentException("Sai view. Chỉ nhận: summary, sheet.");

            Target t = target(request, context);
            if (t == null) {
                return support.respond(context, "get_conduct", Map.of("message",
                        "Không xác định được kỳ/đợt để xem hạnh kiểm (tổ chức chưa có đợt đánh giá nào)."));
            }

            Object response;
            if ("sheet".equals(view)) {
                UserRef user = support.resolveUser(request.userId(), request.userName(), context);
                if (user.clarification() != null) return support.respond(context, "get_conduct", user.clarification());
                support.validateUserAccess(user.id(), context);
                ConductSheetResponse sheet = conductService.getSheet(user.id(), t.scope(), t.periodId(), t.cycleId());
                response = sheet;
            } else {
                UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                if (u.clarification() != null) return support.respond(context, "get_conduct", u.clarification());
                List<ConductSummaryResponse> rows = conductService.listUnitSummary(u.id(), t.scope(), t.periodId(), t.cycleId());
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("target", t.label());
                out.put("memberCount", rows.size());
                out.put("notSelfScored", rows.stream().filter(r -> r.getSelfScore() == null).map(ConductSummaryResponse::getUserName).toList());
                out.put("notManagerScored", rows.stream().filter(r -> r.getManagerScore() == null).map(ConductSummaryResponse::getUserName).toList());
                out.put("rows", rows.stream().map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("userName", r.getUserName());
                    m.put("roleName", r.getRoleName());
                    m.put("orgUnitName", r.getOrgUnitName());
                    m.put("status", r.getStatus() != null ? r.getStatus().name() : ConductStatus.class.getSimpleName());
                    m.put("selfScore", r.getSelfScore());
                    m.put("managerScore", r.getManagerScore());
                    return m;
                }).toList());
                response = out;
            }
            return support.respond(context, "get_conduct", response);
        } catch (Exception e) {
            return support.toolError("get_conduct", e);
        }
    }

    /** Đối tượng chấm đã giải: theo kỳ hoặc theo đợt. */
    record Target(ConductScope scope, UUID periodId, UUID cycleId, String label) {}

    Target target(ConductRequest request, InvocationParameters context) {
        if (ToolSupport.notBlank(request.periodName())) {
            UUID periodId = support.resolvePeriodId(request.periodName(), context);
            if (periodId == null) throw new IllegalArgumentException("Không tìm thấy kỳ KPI '" + request.periodName().trim() + "'.");
            return new Target(ConductScope.PERIOD, periodId, null, "kỳ " + request.periodName().trim());
        }
        KpiCycle cycle = cycleEvaluationTool.resolveCycle(request.cycleName(), support.getOrgId(context));
        if (cycle == null) return null;
        return new Target(ConductScope.CYCLE, null, cycle.getId(), "đợt " + cycle.getName());
    }

    private static String normalizeView(String raw) {
        if (raw == null || raw.isBlank()) return "summary";
        String s = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (s) {
            case "summary", "unit", "list", "overview" -> "summary";
            case "sheet", "user", "person", "detail" -> "sheet";
            default -> null;
        };
    }
}
