package com.kpitracking.tool;

import com.kpitracking.dto.response.kpi.CycleUnitStatusResponse;
import com.kpitracking.dto.response.kpi.CycleUserRankResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.repository.KpiCycleRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.service.KpiCycleEvaluationService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.CycleEvaluationRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import com.kpitracking.tool.ToolSupport.UserRef;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Đợt đánh giá ({@code KpiCycle}): điểm của đơn vị, chuỗi phê duyệt, đơn vị nào chưa chốt, người nào
 * đã/chưa được đánh giá. Mảng này có màn hình riêng nhưng trợ lý mù hoàn toàn cho tới nay.
 *
 * <p>Phạm vi: đơn vị đi qua {@code resolveUnit} (cây của người hỏi); hai view danh sách
 * ({@code units}, {@code users}) do dịch vụ tự thu về cây của người đăng nhập ({@code unitsInScope}),
 * tool chỉ lọc thêm theo đơn vị nếu người dùng nêu. Quyền {@code CYCLE_EVAL:VIEW} kiểm ở
 * {@code ToolRegistry} — không có quyền thì model không nhìn thấy tool.
 */
@Component
@RequiredArgsConstructor
public class CycleEvaluationTool {

    private final KpiCycleEvaluationService cycleEvaluationService;
    private final KpiCycleRepository kpiCycleRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final ToolSupport support;

    @Tool(name = "get_cycle_evaluation", value = "ĐỢT ĐÁNH GIÁ (kỳ chốt điểm): điểm và trạng thái chốt. "
            + "view=unit (mặc định): MỘT đơn vị trong đợt — điểm tự chấm, điểm quản lý, điểm tự động, ghi đè, "
            + "trạng thái DRAFT/FINALIZED, ai chốt lúc nào. "
            + "view=chain: chuỗi phê duyệt từ đơn vị lên gốc — bậc nào đã chốt, bậc nào đang giữ. "
            + "view=units: mọi đơn vị trong phạm vi của bạn — đơn vị nào CHƯA chốt, điểm, xếp loại. "
            + "view=users: từng NGƯỜI trong đợt — điểm cuối, xếp hạng, ai chưa được đánh giá; truyền unitName để thu hẹp. "
            + "view=user: MỘT người (userName/userId) — tự chấm, quản lý chấm, điểm cuối, hạnh kiểm. "
            + "cycleName: tên đợt (vd 'Tháng 6/2026'); bỏ trống = đợt đang diễn ra hoặc gần nhất. "
            + "Đây là ĐỢT đánh giá (chốt điểm cuối), KHÁC kỳ KPI (get_kpi view=periods) và KHÁC bài nộp (get_submissions). "
            + "Chốt/mở lại đợt KHÔNG làm được ở đây.")
    public String getCycleEvaluation(CycleEvaluationRequest request, InvocationParameters context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Sai view. Chỉ nhận: unit, chain, units, users, user.");
            }
            KpiCycle cycle = resolveCycle(request.cycleName(), support.getOrgId(context));
            if (cycle == null) {
                return support.respond(context, "get_cycle_evaluation", Map.of(
                        "message", "Tổ chức chưa có đợt đánh giá nào" + (ToolSupport.notBlank(request.cycleName())
                                ? " khớp '" + request.cycleName().trim() + "'." : ".")));
            }

            Object response = switch (view) {
                case "unit" -> {
                    UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                    if (u.clarification() != null) yield u.clarification();
                    yield withCycle(cycle, cycleEvaluationService.getUnitCycleSummary(cycle.getId(), u.id()));
                }
                case "chain" -> {
                    UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                    if (u.clarification() != null) yield u.clarification();
                    yield withCycle(cycle, cycleEvaluationService.getApprovalChain(cycle.getId(), u.id()));
                }
                case "units" -> {
                    List<CycleUnitStatusResponse> rows = cycleEvaluationService.listUnitStatuses(cycle.getId());
                    long pending = rows.stream().filter(r -> r.getStatus() != CycleUnitEvalStatus.FINALIZED).count();
                    Map<String, Object> out = withCycle(cycle, rows);
                    out.put("unitCount", rows.size());
                    out.put("notFinalizedCount", pending);
                    yield out;
                }
                case "users" -> {
                    List<CycleUserRankResponse> rows = cycleEvaluationService.listUserRankings(cycle.getId());
                    if (ToolSupport.notBlank(request.unitName()) || ToolSupport.notBlank(request.unitId())) {
                        UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                        if (u.clarification() != null) yield u.clarification();
                        // Thu hẹp theo CÂY của đơn vị nêu tên: hỏi "Phòng IT" phải thấy cả người của Team
                        // Backend/Frontend, vì dòng xếp hạng chỉ mang tên đơn vị trực tiếp của mỗi người.
                        Set<String> subtree = orgUnitRepository.findAllInSubtrees(List.of(u.id()), support.getOrgId(context))
                                .stream().map(OrgUnit::getName).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
                        rows = rows.stream().filter(r -> r.getOrgUnitName() != null && subtree.contains(r.getOrgUnitName())).toList();
                    }
                    long unscored = rows.stream().filter(r -> r.getFinalScore() == null).count();
                    Map<String, Object> out = withCycle(cycle, rows);
                    out.put("userCount", rows.size());
                    out.put("notEvaluatedCount", unscored);
                    yield out;
                }
                case "user" -> {
                    UserRef user = support.resolveUser(request.userId(), request.userName(), context);
                    if (user.clarification() != null) yield user.clarification();
                    support.validateUserAccess(user.id(), context);
                    yield withCycle(cycle, cycleEvaluationService.getUserCycleEvaluation(cycle.getId(), user.id()));
                }
                default -> throw new IllegalStateException("view chưa xử lý: " + view);
            };
            return support.respond(context, "get_cycle_evaluation", response);
        } catch (Exception e) {
            return support.toolError("get_cycle_evaluation", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null || raw.isBlank()) return "unit";
        String s = raw.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (s) {
            case "unit", "summary", "detail", "org_unit" -> "unit";
            case "chain", "approval_chain", "approval" -> "chain";
            case "units", "list", "status", "statuses" -> "units";
            case "users", "people", "members", "rankings", "ranking" -> "users";
            case "user", "person", "member" -> "user";
            default -> null;
        };
    }

    /**
     * Đợt theo tên (khớp một phần, không phân biệt hoa thường); không nêu tên thì đợt đang diễn ra,
     * không có đợt nào đang diễn ra thì đợt gần nhất — đúng thứ người dùng gọi là "đợt này".
     */
    KpiCycle resolveCycle(String cycleName, UUID orgId) {
        List<KpiCycle> cycles = kpiCycleRepository.findByOrganizationIdOrderByStartDateDesc(orgId);
        if (cycles.isEmpty()) return null;
        if (ToolSupport.notBlank(cycleName)) {
            String wanted = cycleName.trim().toLowerCase(Locale.ROOT);
            return cycles.stream()
                    .filter(c -> c.getName() != null && c.getName().toLowerCase(Locale.ROOT).contains(wanted))
                    .findFirst().orElse(null);
        }
        Instant now = Instant.now();
        return cycles.stream()
                .filter(c -> c.getStartDate() != null && c.getEndDate() != null
                        && !now.isBefore(c.getStartDate()) && !now.isAfter(c.getEndDate()))
                .findFirst()
                .orElse(cycles.get(0));
    }

    private static Map<String, Object> withCycle(KpiCycle cycle, Object data) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cycleName", cycle.getName());
        out.put("cycleStart", cycle.getStartDate() != null ? cycle.getStartDate().toString() : null);
        out.put("cycleEnd", cycle.getEndDate() != null ? cycle.getEndDate().toString() : null);
        out.put("data", data);
        return out;
    }

}
