package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.KpiRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * KPI và kỳ đánh giá — gộp từ get_kpis, get_kpi_summary, get_kpi_detail, get_kpi_assignees,
 * get_kpi_period_breakdown và get_kpi_periods.
 *
 * <p>Sáu tool cũ chia thành hai nhóm tham số rất khác nhau: nhóm theo ĐƠN VỊ (list/summary/periods)
 * và nhóm theo MỘT KPI cụ thể (detail/assignees/period_breakdown). Ranh giới đó được kiểm chặt
 * bên dưới thay vì mô tả bằng lời.
 */
@Component
@RequiredArgsConstructor
public class KpiTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final ToolSupport support;

    @Tool(name = "get_kpi", description = "KPI và kỳ đánh giá. "
            + "view=list: danh sách KPI của một đơn vị, mỗi KPI có name, periodName, progress (% đạt mục tiêu); "
            + "KHÔNG trả ID — cần UUID thì dùng search (entityType=kpi). "
            // Trước đây chỉ ghi "số liệu tổng hợp", nghe y hệt get_analytics(view=dashboard) nên
            // model chọn ngẫu nhiên giữa hai thứ — đo được: cùng câu "tổng quan KPI" lúc gọi tool
            // này lúc gọi tool kia. Nói rõ tool nào trả cái gì thì mới hết chập chờn.
            + "view=summary: số liệu về CHỈ TIÊU của đơn vị — tổng số KPI, tiến độ trung bình, "
            + "hiệu suất trung bình, số đã hoàn thành / đang làm / quá hạn. "
            + "Đây là tool cho câu 'tổng quan KPI của đơn vị'. "
            + "view=periods: các kỳ KPI (số người tham gia, số KPI, tiến độ/hiệu suất trung bình); mặc định là "
            + "TOÀN tổ chức, truyền unitName để chỉ lấy kỳ mà đơn vị đó THAM GIA. "
            + "view=detail: chi tiết MỘT KPI (tiến độ, hiệu suất, hạn, người giao, người nhận), cần kpiId. "
            + "view=assignees: danh sách người được giao. NÊN truyền kpiName — một KPI lặp qua nhiều "
            + "kỳ có nhiều bản trùng tên, truyền tên sẽ GỘP người được giao của tất cả các bản và ghi "
            + "rõ từng người thuộc những kỳ nào; kpiId chỉ nhắm đúng một bản. "
            + "view=period_breakdown: diễn biến của MỘT KPI theo từng kỳ (dùng cho 'KPI X tiến triển thế nào'); "
            + "nhận kpiId HOẶC kpiName, và với kpiName thì tự gộp mọi kỳ trùng tên nên đừng hỏi lại người dùng chọn kỳ, "
            + "cần kpiId; granularity=MONTH|QUARTER|YEAR. "
            + "Các view theo đơn vị mặc định là đơn vị hiện tại, nên khi người dùng nêu tên đơn vị PHẢI truyền unitName.")
    public String getKpi(KpiRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: "
                        + "list, summary, periods, detail, assignees, period_breakdown.");
            }
            boolean perKpi = "detail".equals(view) || "assignees".equals(view) || "period_breakdown".equals(view);
            return perKpi ? perKpi(view, request, context) : byUnit(view, request, context);
        } catch (Exception e) {
            return support.toolError("get_kpi", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "list", "kpis" -> "list";
            case "summary", "stats", "statistics" -> "summary";
            case "periods", "period_list", "kpi_periods" -> "periods";
            case "detail", "details", "info" -> "detail";
            case "assignees", "assignee", "members" -> "assignees";
            case "period_breakdown", "breakdown", "by_period", "trend" -> "period_breakdown";
            default -> null;
        };
    }

    /** Ba view nhắm vào MỘT KPI: bắt buộc kpiId, và không nhận tham số lọc theo đơn vị. */
    private String perKpi(String view, KpiRequest request, ToolContext context) throws Exception {
        if (ToolSupport.notBlank(request.unitName()) || ToolSupport.notBlank(request.unitId())) {
            throw new IllegalArgumentException("view=" + view + " nhắm vào MỘT KPI nên không nhận "
                    + "unitName/unitId. Muốn xem KPI của một đơn vị thì dùng view=list hoặc view=summary.");
        }
        // view=assignees nhận thêm kpiName để GỘP người được giao qua mọi kỳ trùng tên — giống
        // cách get_submissions(kpiName) đã làm. Không có đường này thì câu "KPI X có những ai
        // được giao?" không trả lời được, vì một KPI lặp qua nhiều kỳ và assignees đòi đúng MỘT
        // kpiId; model chỉ còn cách hỏi lại người dùng chọn kỳ, dù họ hỏi về cả KPI.
        if (("assignees".equals(view) || "period_breakdown".equals(view))
                && !ToolSupport.notBlank(request.kpiId())
                && ToolSupport.notBlank(request.kpiName())) {
            Object byName = "assignees".equals(view)
                    ? assigneesByName(request.kpiName(), context)
                    : periodBreakdownByName(request.kpiName(), request, context);
            return support.respond(context, "get_kpi", byName);
        }

        if (!ToolSupport.notBlank(request.kpiId())) {
            // Câu này phải nói TIẾP phải làm gì, không được là ngõ cụt. Đo được: model search ra ba
            // KPI trùng tên, không chọn được bản nào, gọi get_kpi không kèm kpiId, bị từ chối ba lần
            // rồi bỏ cuộc và quay ra hỏi người dùng chọn kỳ — dù câu hỏi là "qua CÁC kỳ".
            boolean acceptsName = "assignees".equals(view) || "period_breakdown".equals(view);
            throw new IllegalArgumentException("view=" + view + " cần kpiId"
                    + (acceptsName
                        ? " hoặc kpiName. Tên khớp nhiều kỳ thì cứ truyền kpiName — tool tự gộp cả "
                          + "cụm KPI trùng tên đó lại, KHÔNG cần hỏi người dùng chọn kỳ."
                        : ". Dùng search (entityType=kpi) để lấy UUID trước."));
        }
        UUID kpiId = support.parseId(request.kpiId(), "KPI (kpiId)", "search (entityType=kpi)");
        support.guardDisambiguation("kpi", kpiId, "KPI", context);
        support.validateKpiAccess(kpiId, context);

        Object response = switch (view) {
            case "detail" -> orgUnitStatisticService.getKpiDetail(kpiId, request.startDate(), request.endDate());
            case "assignees" -> orgUnitStatisticService.getKpiAssignees(kpiId);
            case "period_breakdown" -> {
                if (ToolSupport.notBlank(request.userId())) {
                    support.parseId(request.userId(), "người dùng (userId)", "search (entityType=user)");
                }
                yield orgUnitStatisticService.getKpiPeriodBreakdown(
                        kpiId, request.userId(), request.granularity(),
                        request.startDate(), request.endDate());
            }
            default -> throw new IllegalStateException("view chưa xử lý: " + view);
        };
        return support.respond(context, "get_kpi", response);
    }

    /**
     * Gộp người được giao của MỌI KPI trùng tên (một KPI lặp qua nhiều kỳ), khử trùng theo email
     * và ghi lại người đó được giao ở những kỳ nào.
     */
    private Map<String, Object> assigneesByName(String kpiName, ToolContext context) {
        List<Map<String, Object>> pool = support.kpiMatchPool(kpiName, support.getOrgId(context));

        // LinkedHashMap để giữ thứ tự xuất hiện — câu trả lời ổn định giữa các lần gọi.
        Map<String, Map<String, Object>> byEmail = new LinkedHashMap<>();
        List<String> periods = new ArrayList<>();

        for (Map<String, Object> match : pool) {
            UUID kpiId = UUID.fromString(String.valueOf(match.get("id")));
            if (!support.hasKpiAccess(kpiId, context)) continue;

            String period = match.get("periodName") != null ? String.valueOf(match.get("periodName")) : null;
            if (period != null && !periods.contains(period)) periods.add(period);

            Map<String, Object> one = orgUnitStatisticService.getKpiAssignees(kpiId);
            Object list = one.get("assignees");
            if (!(list instanceof List<?> rows)) continue;

            for (Object row : rows) {
                if (!(row instanceof Map<?, ?> r)) continue;
                String email = r.get("email") != null ? String.valueOf(r.get("email")) : null;
                if (email == null) continue;

                Map<String, Object> merged = byEmail.computeIfAbsent(email, k -> {
                    Map<String, Object> copy = new LinkedHashMap<>();
                    r.forEach((key, value) -> copy.put(String.valueOf(key), value));
                    copy.put("periods", new ArrayList<String>());
                    return copy;
                });
                @SuppressWarnings("unchecked")
                List<String> ps = (List<String>) merged.get("periods");
                if (period != null && !ps.contains(period)) ps.add(period);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpiName", kpiName.trim());
        response.put("matchedKpiCount", periods.size());
        response.put("periods", periods);
        response.put("assigneesCount", byEmail.size());
        response.put("assignees", new ArrayList<>(byEmail.values()));
        if (byEmail.isEmpty()) {
            response.put("message", "Không tìm thấy KPI tên '" + kpiName.trim()
                    + "' trong phạm vi của bạn, hoặc KPI đó chưa giao cho ai.");
        }
        return response;
    }

    /**
     * Diễn biến của MỌI KPI trùng tên, gộp lại theo từng kỳ.
     *
     * <p>Sinh ra vì đúng lý do đã ghi ở {@link #assigneesByName}: trong dữ liệu thật một KPI lặp
     * qua nhiều kỳ dưới cùng một cái tên, mà {@code period_breakdown} lại đòi đúng MỘT {@code kpiId}.
     * Người dùng hỏi "KPI X tiến triển ra sao QUA CÁC KỲ" thì ý họ là cả cụm đó, nhưng model tra tên
     * ra ba bản rồi không biết chọn bản nào — nên nó quay ra hỏi lại người dùng chọn kỳ, đúng thứ
     * câu hỏi vừa bảo là không cần chọn.
     *
     * <p>Đo được ở bộ câu hỏi (B03): model gọi {@code get_kpi} ba lần không kèm {@code kpiId}, bị
     * từ chối cả ba, rồi bỏ cuộc và hỏi lại. Đây là chốt chặn tất định cho ngõ cụt đó — không phải
     * dặn thêm model.
     */
    private Map<String, Object> periodBreakdownByName(String kpiName, KpiRequest request,
                                                      ToolContext context) {
        List<Map<String, Object>> pool = support.kpiMatchPool(kpiName, support.getOrgId(context));

        // LinkedHashMap/ArrayList để giữ thứ tự xuất hiện — câu trả lời ổn định giữa các lần gọi.
        List<Map<String, Object>> perKpiPeriod = new ArrayList<>();
        List<String> periods = new ArrayList<>();

        for (Map<String, Object> match : pool) {
            UUID kpiId = UUID.fromString(String.valueOf(match.get("id")));
            if (!support.hasKpiAccess(kpiId, context)) continue;

            String period = match.get("periodName") != null ? String.valueOf(match.get("periodName")) : null;
            if (period != null && !periods.contains(period)) periods.add(period);

            Map<String, Object> one = orgUnitStatisticService.getKpiPeriodBreakdown(
                    kpiId, request.userId(), request.granularity(),
                    request.startDate(), request.endDate());

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("periodName", period);
            entry.putAll(one);
            perKpiPeriod.add(entry);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("kpiName", kpiName.trim());
        response.put("matchedKpiCount", perKpiPeriod.size());
        response.put("periods", periods);
        response.put("breakdown", perKpiPeriod);
        if (perKpiPeriod.isEmpty()) {
            response.put("message", "Không tìm thấy KPI tên '" + kpiName.trim()
                    + "' trong phạm vi của bạn.");
        }
        return response;
    }

    /** Ba view nhắm vào một ĐƠN VỊ: kpiId không có nghĩa ở đây. */
    private String byUnit(String view, KpiRequest request, ToolContext context) throws Exception {
        if (ToolSupport.notBlank(request.kpiId())) {
            throw new IllegalArgumentException("kpiId chỉ dùng với view=detail|assignees|period_breakdown, "
                    + "không dùng với view=" + view + ".");
        }
        for (String[] pair : new String[][]{
                {request.ownerId(), "ownerId"}, {request.assignedById(), "assignedById"},
                {request.assignedToId(), "assignedToId"}}) {
            if (ToolSupport.notBlank(pair[0])) {
                support.validateUserAccess(
                        support.parseId(pair[0], "người dùng (" + pair[1] + ")", "search (entityType=user)"), context);
            }
        }
        if (ToolSupport.notBlank(request.periodId())) {
            support.parseId(request.periodId(), "kỳ KPI (periodId)", "search (entityType=period)");
        }

        // view=periods mặc định là TOÀN tổ chức: chỉ resolve đơn vị khi người dùng thực sự nêu tên,
        // nếu không sẽ âm thầm thu hẹp về đơn vị hiện tại và trả thiếu kỳ.
        boolean namesUnit = ToolSupport.notBlank(request.unitId()) || ToolSupport.notBlank(request.unitName());
        if ("periods".equals(view)) {
            UUID targetUnitId = null;
            if (namesUnit) {
                UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
                if (u.clarification() != null) return support.respond(context, "get_kpi", u.clarification());
                targetUnitId = u.id();
            }
            return support.respond(context, "get_kpi", orgUnitStatisticService.getKpiPeriods(
                    support.getOrgId(context), targetUnitId, request.startDate(), request.endDate()));
        }

        UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
        if (u.clarification() != null) return support.respond(context, "get_kpi", u.clarification());

        Object response = "list".equals(view)
                ? orgUnitStatisticService.getKpis(
                        u.id(), request.ownerId(), request.assignedById(), request.assignedToId(),
                        request.periodId(), request.status(), request.page(), request.size(),
                        request.sortBy(), request.sortDirection(), request.startDate(), request.endDate())
                : orgUnitStatisticService.getKpiSummary(
                        u.id(), request.ownerId(), request.assignedById(), request.assignedToId(),
                        request.periodId(), request.status(), request.startDate(), request.endDate());
        return support.respond(context, "get_kpi", response);
    }
}
