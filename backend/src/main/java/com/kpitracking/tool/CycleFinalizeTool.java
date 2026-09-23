package com.kpitracking.tool;

import com.kpitracking.dto.response.kpi.CycleUnitEvaluationResponse;
import com.kpitracking.dto.response.kpi.CycleUserRankResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiCycleEvaluationService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.CycleFinalizeRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Chốt / mở lại / gửi kết quả đợt đánh giá của MỘT đơn vị — thao tác ghi rủi ro cao nhất của trợ lý.
 *
 * <p>Vì sao lời mời phải MANG THEO ĐIỂM: chốt là khoá điểm cuối của mọi người trong đơn vị (và khoá kế
 * thừa xuống các đơn vị con). Người bấm xác nhận phải thấy đúng cái sẽ bị khoá — điểm từng người
 * và điểm đơn vị — chứ không phải một dòng "chốt Phòng IT". Nên payload trả cho model có
 * {@code preview} đầy đủ, và mô tả tool bắt model nêu nó ra trước khi mời.
 *
 * <p>Ba luật của dịch vụ được KIỂM TRƯỚC khi mời (đã chốt rồi thì không chốt lại; đơn vị cấp trên
 * đang chốt thì không mở/chốt ở dưới; gửi kết quả cần {@code CYCLE_EVAL:SEND} riêng) — mời rồi mới
 * hỏng là trải nghiệm tệ nhất. Thực thi thật nằm ở {@code PendingActionExecutor}.
 */
@Component
@RequiredArgsConstructor
public class CycleFinalizeTool {

    private final KpiCycleEvaluationService cycleEvaluationService;
    private final CycleEvaluationTool cycleEvaluationTool;
    private final OrgUnitRepository orgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "finalize_cycle_evaluation", value =
            "CHỐT / MỞ LẠI / GỬI KẾT QUẢ đợt đánh giá của MỘT đơn vị. action=finalize (chốt điểm, khoá cả đơn vị con), "
            + "reopen (mở khoá để chấm lại), send (gửi email kết quả cho thành viên — chỉ sau khi đã chốt). "
            + "Đây là thao tác GHI RỦI RO CAO: tool chỉ chuẩn bị lời mời kèm ĐIỂM TỪNG NGƯỜI và điểm đơn vị (preview); "
            + "bạn PHẢI nêu các điểm đó cho người dùng xem rồi mới mời họ bấm xác nhận — KHÔNG tự thực hiện, KHÔNG nói đã chốt. "
            + "cycleName bỏ trống = đợt đang diễn ra/gần nhất; comment = nhận xét khi chốt (tuỳ chọn). "
            + "Người dùng nêu tên đơn vị thì PHẢI truyền unitName.")
    public String finalizeCycle(CycleFinalizeRequest request, InvocationParameters context) {
        try {
            String action = normalizeAction(request.action());
            if (action == null) throw new IllegalArgumentException("Sai action. Chỉ nhận: finalize, reopen, send.");

            UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "finalize_cycle_evaluation", u.clarification());
            KpiCycle cycle = cycleEvaluationTool.resolveCycle(request.cycleName(), support.getOrgId(context));
            if (cycle == null) {
                return support.respond(context, "finalize_cycle_evaluation",
                        Map.of("message", "Tổ chức chưa có đợt đánh giá nào" + (ToolSupport.notBlank(request.cycleName())
                                ? " khớp '" + request.cycleName().trim() + "'." : ".")));
            }
            Object rawUser = context.get("userId");
            UUID me = rawUser == null ? null : UUID.fromString(rawUser.toString());
            if ("send".equals(action) && (me == null || !permissionChecker.hasPermission(me, "CYCLE_EVAL:SEND"))) {
                throw new ForbiddenException("Bạn không có quyền gửi kết quả đợt đánh giá (CYCLE_EVAL:SEND).");
            }

            CycleUnitEvaluationResponse unit = cycleEvaluationService.getUnitCycleSummary(cycle.getId(), u.id());
            boolean finalized = unit.getStatus() == CycleUnitEvalStatus.FINALIZED;
            String blocked = switch (action) {
                case "finalize" -> finalized ? "Đơn vị này ĐÃ chốt đợt " + cycle.getName()
                        + (unit.getFinalizedByName() != null ? " (" + unit.getFinalizedByName() + " chốt)" : "")
                        + ". Muốn chấm lại thì mở khoá (action=reopen) trước." : null;
                case "reopen" -> !finalized ? "Đơn vị này CHƯA chốt đợt " + cycle.getName() + " nên không có gì để mở lại." : null;
                default -> !finalized ? "Chưa chốt đợt " + cycle.getName() + " thì chưa gửi kết quả được — chốt trước." : null;
            };
            if (blocked != null) {
                return support.respond(context, "finalize_cycle_evaluation", Map.of("blocked", true, "message", blocked,
                        "guidance", "Nói rõ cho người dùng. ĐỪNG mời xác nhận."));
            }

            // Bảng điểm từng người trong cây đơn vị — thứ sẽ bị khoá/gửi đi.
            Set<String> subtree = orgUnitRepository.findAllInSubtrees(List.of(u.id()), support.getOrgId(context))
                    .stream().map(OrgUnit::getName).collect(Collectors.toSet());
            List<Map<String, Object>> people = cycleEvaluationService.listUserRankings(cycle.getId()).stream()
                    .filter(r -> r.getOrgUnitName() != null && subtree.contains(r.getOrgUnitName()))
                    .map(CycleFinalizeTool::personRow).toList();

            String verb = switch (action) { case "finalize" -> "Chốt"; case "reopen" -> "Mở lại"; default -> "Gửi kết quả"; };
            Kind kind = switch (action) { case "finalize" -> Kind.CYCLE_FINALIZE; case "reopen" -> Kind.CYCLE_REOPEN; default -> Kind.CYCLE_SEND; };
            String detail = "tự chấm " + fmt(unit.getSelfScore()) + " · quản lý " + fmt(unit.getManagerScore())
                    + " · " + unit.getMemberCount() + " người" + (unit.getClassification() != null ? " · " + unit.getClassification() : "");
            Item item = new Item(u.id(), cycle.getId(), unit.getOrgUnitName() + " — đợt " + cycle.getName(), detail);

            String proposal = actions.propose(context, "finalize_cycle_evaluation", kind,
                    verb + " đợt đánh giá " + cycle.getName() + " của " + unit.getOrgUnitName(),
                    Decision.APPROVE, request.comment(), List.of(item));

            Map<String, Object> preview = new LinkedHashMap<>();
            preview.put("cycleName", cycle.getName());
            preview.put("unitName", unit.getOrgUnitName());
            preview.put("unitSelfScore", unit.getSelfScore());
            preview.put("unitManagerScore", unit.getManagerScore());
            preview.put("unitAutoScore", unit.getAutoScore());
            preview.put("classification", unit.getClassification());
            preview.put("memberCount", unit.getMemberCount());
            preview.put("people", people);
            preview.put("notEvaluatedCount", people.stream().filter(p -> p.get("finalScore") == null).count());
            return proposal.replaceFirst("\\{", "{\"preview\":" + support.toJson(preview) + ",");
        } catch (Exception e) {
            return support.toolError("finalize_cycle_evaluation", e);
        }
    }

    private static Map<String, Object> personRow(CycleUserRankResponse r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userName", r.getUserName());
        m.put("orgUnitName", r.getOrgUnitName());
        m.put("finalScore", r.getFinalScore());
        m.put("qualScore", r.getQualScore());
        m.put("matrixRating", r.getMatrixRating());
        m.put("rank", r.getRank());
        return m;
    }

    private static String fmt(Double v) {
        return v == null ? "—" : String.valueOf(Math.round(v * 10.0) / 10.0);
    }

    private static String normalizeAction(String raw) {
        if (raw == null || raw.isBlank()) return "finalize";
        String s = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (s) {
            case "finalize", "finalise", "lock", "close", "chot" -> "finalize";
            case "reopen", "unlock", "open" -> "reopen";
            case "send", "notify", "email" -> "send";
            default -> null;
        };
    }
}
