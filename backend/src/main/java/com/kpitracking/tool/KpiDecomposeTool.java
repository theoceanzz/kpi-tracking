package com.kpitracking.tool;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiParentRelationType;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.DecomposeKpiRequest;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.DecomposeShare;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Phân rã (hoặc uỷ quyền) MỘT chỉ tiêu xuống các đơn vị con — tạo chỉ tiêu con cho từng đơn vị.
 *
 * <p>Ba cách chia: {@code headcount} (theo tỉ lệ nhân sự — mặc định), {@code equal} (chia đều), hoặc
 * {@code shares} do người dùng nêu rõ (đơn vị + mục tiêu/trọng số). Trọng số con cộng lại bằng trọng
 * số cha, mục tiêu con cộng lại bằng mục tiêu cha — cùng luật với dữ liệu mẫu và biểu đồ Sankey (lệch
 * là biểu đồ nói dối về tỉ lệ phân bổ).
 *
 * <p>Là thao tác GHI: lời mời mang từng đơn vị con kèm mục tiêu/trọng số ({@code Item.params});
 * {@code PendingActionExecutor} gọi {@code KpiCriteriaService.decomposeInto} cho từng mục khi người
 * dùng xác nhận. Quyền {@code KPI:CREATE} kiểm ở {@code ToolRegistry}; dịch vụ kiểm lại theo từng đơn vị.
 */
@Component
@RequiredArgsConstructor
public class KpiDecomposeTool {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "decompose_kpi", value =
            "PHÂN RÃ hoặc UỶ QUYỀN một chỉ tiêu KPI xuống các đơn vị con: tạo chỉ tiêu con cho từng đơn vị với mục tiêu và "
            + "trọng số chia từ chỉ tiêu cha. Cần kpiName (hoặc kpiId) của chỉ tiêu cha; periodName nếu tên KPI lặp qua nhiều kỳ. "
            + "mode=headcount (mặc định, theo tỉ lệ nhân sự) | equal (chia đều); hoặc truyền shares=[{unitName, targetValue, weight}] "
            + "khi người dùng nêu con số cụ thể. relation=DECOMPOSITION (mặc định) | DELEGATION. "
            + "Mặc định chia cho MỌI đơn vị con trực tiếp chưa nhận; unitNames để chỉ chia cho vài đơn vị. "
            + "Đây là thao tác GHI: tool chỉ chuẩn bị bảng chia và chờ người dùng bấm xác nhận, KHÔNG tự tạo. "
            + "Chỉ xem phân rã hiện có thì dùng get_kpi(view=cascade).")
    public String decompose(DecomposeKpiRequest request, InvocationParameters context) {
        try {
            KpiCriteria parent = resolveParent(request, context);
            if (parent == null) {
                return support.respond(context, "decompose_kpi", Map.of("message",
                        "Không tìm thấy chỉ tiêu cha khớp yêu cầu trong phạm vi của bạn. Dùng get_kpi(view=list) để lấy đúng tên/kỳ."));
            }
            if (parent.getStatus() == KpiStatus.REPLACED || parent.getStatus() == KpiStatus.INACTIVE) {
                throw new IllegalArgumentException("Chỉ tiêu cha đang ở trạng thái " + parent.getStatus() + ", không phân rã được.");
            }
            KpiParentRelationType relation = relationOf(request.relation());

            // Đơn vị con đã nhận phần → không chia lại; còn lại là ứng viên.
            List<KpiCriteria> existing = kpiCriteriaRepository.findByParentId(parent.getId()).stream()
                    .filter(c -> c.getOrgUnit() != null).toList();
            Set<UUID> alreadyReceiving = existing.stream().map(c -> c.getOrgUnit().getId()).collect(Collectors.toSet());
            List<OrgUnit> children = orgUnitRepository.findByParentId(parent.getOrgUnit().getId()).stream()
                    .filter(u -> u.getDeletedAt() == null && !alreadyReceiving.contains(u.getId())).toList();

            List<Map<String, Object>> plan = request.shares() != null && !request.shares().isEmpty()
                    ? explicitPlan(parent, request.shares(), children)
                    : computedPlan(parent, request, children);
            if (plan.isEmpty()) {
                // Trả luôn phần đã chia để model tường thuật được "đã nhận" mà không phải đi tra thêm
                // get_kpi/get_people (đo D16: thiếu dữ liệu này, model tự đi tính lại và đề xuất tỉ lệ mới).
                List<Map<String, Object>> received = existing.stream().map(c -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("unitName", c.getOrgUnit().getName());
                    m.put("targetValue", c.getTargetValue());
                    m.put("weight", c.getWeight());
                    m.put("relation", c.getParentRelationType() != null ? c.getParentRelationType().name() : null);
                    return m;
                }).toList();
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("nothingToDo", true);
                out.put("message", received.isEmpty()
                        ? "Đơn vị sở hữu chỉ tiêu này không có đơn vị con nào để phân rã."
                        : "Mọi đơn vị con ĐÃ NHẬN phần phân rã của chỉ tiêu này — không còn đơn vị nào để chia thêm. "
                        + "Hãy nói rõ các đơn vị đã nhận và phần của từng đơn vị; muốn đổi tỉ lệ thì sửa từng chỉ tiêu con "
                        + "trên màn hình KPI, tool này không chia lại.");
                out.put("alreadyReceiving", received);
                return support.respond(context, "decompose_kpi", out);
            }

            List<Item> items = new ArrayList<>();
            for (Map<String, Object> p : plan) {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("targetValue", p.get("targetValue"));
                params.put("weight", p.get("weight"));
                params.put("relation", relation.name());
                items.add(new Item((UUID) p.get("unitId"), parent.getId(), (String) p.get("unitName"),
                        "mục tiêu " + p.get("targetValue") + (parent.getUnit() != null ? " " + parent.getUnit() : "")
                                + " · trọng số " + p.get("weight") + " %" + " · " + p.get("basis"), params));
            }
            String verb = relation == KpiParentRelationType.DELEGATION ? "Uỷ quyền" : "Phân rã";
            String proposal = actions.propose(context, "decompose_kpi", Kind.KPI_DECOMPOSE,
                    verb + " chỉ tiêu \"" + parent.getName() + "\" xuống " + items.size() + " đơn vị",
                    Decision.APPROVE, null, items);
            Map<String, Object> preview = new LinkedHashMap<>();
            preview.put("parentName", parent.getName());
            preview.put("parentUnit", parent.getOrgUnit().getName());
            preview.put("parentTarget", parent.getTargetValue());
            preview.put("parentWeight", parent.getWeight());
            preview.put("plan", plan);
            return proposal.replaceFirst("\\{", "{\"preview\":" + support.toJson(preview) + ",");
        } catch (Exception e) {
            return support.toolError("decompose_kpi", e);
        }
    }

    /** Chỉ tiêu cha theo id, hoặc theo tên (+ kỳ) trong phạm vi của người hỏi; trùng nhiều bản thì lấy bản mới nhất được duyệt. */
    private KpiCriteria resolveParent(DecomposeKpiRequest request, InvocationParameters context) {
        if (ToolSupport.notBlank(request.kpiId())) {
            UUID id = support.parseId(request.kpiId(), "KPI (kpiId)", "search (entityType=kpi)");
            support.validateKpiAccess(id, context);
            return kpiCriteriaRepository.findById(id).orElse(null);
        }
        if (!ToolSupport.notBlank(request.kpiName())) {
            throw new IllegalArgumentException("Cần kpiName hoặc kpiId của chỉ tiêu cha.");
        }
        UUID periodId = support.resolvePeriodId(request.periodName(), context);
        List<KpiCriteria> candidates = new ArrayList<>();
        for (Map<String, Object> m : support.kpiMatchPool(request.kpiName(), support.getOrgId(context))) {
            UUID id = UUID.fromString(String.valueOf(m.get("id")));
            if (!support.hasKpiAccess(id, context)) continue;
            kpiCriteriaRepository.findById(id).ifPresent(k -> {
                if (periodId == null || (k.getKpiPeriod() != null && periodId.equals(k.getKpiPeriod().getId()))) candidates.add(k);
            });
        }
        if (candidates.isEmpty()) return null;
        if (candidates.size() > 1 && periodId == null) {
            String periods = candidates.stream().map(k -> k.getKpiPeriod() != null ? k.getKpiPeriod().getName() : "?")
                    .distinct().collect(Collectors.joining(", "));
            throw new IllegalArgumentException("Chỉ tiêu '" + request.kpiName().trim() + "' có ở nhiều kỳ (" + periods
                    + "). Truyền periodName để chọn đúng bản cần phân rã — đừng tự chọn.");
        }
        return candidates.get(0);
    }

    private List<Map<String, Object>> computedPlan(KpiCriteria parent, DecomposeKpiRequest request, List<OrgUnit> children) {
        List<OrgUnit> targets = children;
        if (request.unitNames() != null && !request.unitNames().isEmpty()) {
            Set<String> wanted = request.unitNames().stream().map(n -> n.trim().toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
            targets = children.stream().filter(u -> u.getName() != null && wanted.contains(u.getName().toLowerCase(Locale.ROOT))).toList();
        }
        if (targets.isEmpty()) return List.of();

        boolean byHeadcount = !"equal".equalsIgnoreCase(request.mode() == null ? "" : request.mode().trim());
        Map<UUID, Long> heads = new LinkedHashMap<>();
        for (OrgUnit u : targets) {
            long n = byHeadcount ? userRoleOrgUnitRepository.findByOrgUnitId(u.getId()).stream()
                    .map(UserRoleOrgUnit::getUser).filter(java.util.Objects::nonNull).map(x -> x.getId()).distinct().count() : 1;
            heads.put(u.getId(), Math.max(n, byHeadcount ? 0 : 1));
        }
        long total = heads.values().stream().mapToLong(Long::longValue).sum();
        if (total == 0) { // không ai trong đơn vị con nào -> chia đều
            heads.replaceAll((k, v) -> 1L);
            total = heads.size();
        }
        double parentTarget = parent.getTargetValue() == null ? 0 : parent.getTargetValue();
        double parentWeight = parent.getWeight() == null ? 0 : parent.getWeight();

        List<Map<String, Object>> plan = new ArrayList<>();
        double targetLeft = parentTarget, weightLeft = parentWeight;
        for (int i = 0; i < targets.size(); i++) {
            OrgUnit u = targets.get(i);
            long n = heads.get(u.getId());
            boolean last = i == targets.size() - 1;
            // Mục cuối nhận phần còn lại để tổng khớp đúng cha, không lệch vì làm tròn.
            double t = last ? round1(targetLeft) : round1(parentTarget * n / total);
            double w = last ? round1(weightLeft) : round1(parentWeight * n / total);
            targetLeft -= t; weightLeft -= w;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("unitId", u.getId());
            row.put("unitName", u.getName());
            row.put("targetValue", t);
            row.put("weight", w);
            row.put("basis", byHeadcount ? n + " nhân sự / " + total : "chia đều");
            plan.add(row);
        }
        return plan;
    }

    private List<Map<String, Object>> explicitPlan(KpiCriteria parent, List<DecomposeShare> shares, List<OrgUnit> children) {
        List<Map<String, Object>> plan = new ArrayList<>();
        for (DecomposeShare s : shares) {
            if (s == null || !ToolSupport.notBlank(s.unitName())) continue;
            String wanted = s.unitName().trim().toLowerCase(Locale.ROOT);
            OrgUnit u = children.stream().filter(c -> c.getName() != null && c.getName().toLowerCase(Locale.ROOT).equals(wanted))
                    .findFirst().orElseThrow(() -> new IllegalArgumentException("'" + s.unitName().trim()
                            + "' không phải đơn vị con trực tiếp còn trống của " + parent.getOrgUnit().getName()
                            + ". Đơn vị con còn trống: " + children.stream().map(OrgUnit::getName).toList()));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("unitId", u.getId());
            row.put("unitName", u.getName());
            row.put("targetValue", s.targetValue() == null ? 0d : s.targetValue());
            row.put("weight", s.weight() == null ? 0d : s.weight());
            row.put("basis", "người dùng nêu");
            plan.add(row);
        }
        double sumW = plan.stream().mapToDouble(r -> (Double) r.get("weight")).sum();
        if (parent.getWeight() != null && Math.abs(sumW - parent.getWeight()) > 0.01) {
            throw new IllegalArgumentException("Tổng trọng số các phần (" + round1(sumW) + " %) phải bằng trọng số cha ("
                    + parent.getWeight() + " %). Hãy sửa shares rồi gọi lại.");
        }
        return plan;
    }

    private static KpiParentRelationType relationOf(String raw) {
        if (raw == null || raw.isBlank()) return KpiParentRelationType.DECOMPOSITION;
        String s = raw.trim().toUpperCase(Locale.ROOT);
        if (s.startsWith("DELEG") || s.contains("UỶ") || s.contains("UY QUYEN")) return KpiParentRelationType.DELEGATION;
        return KpiParentRelationType.DECOMPOSITION;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
