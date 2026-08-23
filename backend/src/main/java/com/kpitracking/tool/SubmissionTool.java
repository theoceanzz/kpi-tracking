package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SubmissionsRequest;
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
 * Bài nộp KPI — gộp từ get_submission_history và get_non_submitters.
 *
 * <p>Hai mặt của cùng một câu hỏi: ai đã nộp gì, và ai chưa nộp. Đứng riêng thì model hay nhầm
 * giữa chúng khi người dùng hỏi "tình hình nộp bài".
 */
@Component
@RequiredArgsConstructor
public class SubmissionTool {

    private final OrgUnitStatisticService orgUnitStatisticService;
    private final ToolSupport support;

    @Tool(name = "get_submissions", description = "Bài nộp KPI. "
            + "view=history: liệt kê từng bài nộp của một KPI theo dòng thời gian. NÊN truyền kpiName — "
            + "một KPI lặp lại (vd theo tuần) có NHIỀU bản trùng tên, truyền tên sẽ gộp bài nộp của TẤT CẢ "
            + "các bản và mỗi dòng có periodName; kpiId chỉ nhắm đúng một bản. Lọc thêm: userId, "
            + "status (PENDING|APPROVED|REJECTED|DRAFT), khoảng ngày, limit. "
            + "view=non_submitters: những người ĐƯỢC GIAO mà CHƯA nộp, chỉ tính các KPI có KỲ giao nhau với "
            + "khoảng ngày (KPI thuộc kỳ trước KHÔNG bị tính). Truyền startDate/endDate cho một khoảng, hoặc "
            + "periodId cho đúng một kỳ, bỏ cả hai = mọi kỳ; mặc định là đơn vị hiện tại nên PHẢI truyền "
            + "unitName khi người dùng nêu tên đơn vị. Kết quả kèm appliedPeriods/appliedScope — hãy NÊU RÕ "
            + "khoảng thời gian đó trong câu trả lời để nếu suy sai ngày tương đối thì người dùng nhìn ra.")
    public String getSubmissions(SubmissionsRequest request, ToolContext context) {
        try {
            String view = normalizeView(request.view());
            if (view == null) {
                throw new IllegalArgumentException("Thiếu hoặc sai view. Chỉ nhận: history, non_submitters.");
            }
            return "history".equals(view) ? history(request, context) : nonSubmitters(request, context);
        } catch (Exception e) {
            return support.toolError("get_submissions", e);
        }
    }

    private static String normalizeView(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase().replace('-', '_');
        return switch (s) {
            case "history", "submissions", "timeline" -> "history";
            case "non_submitters", "nonsubmitters", "missing", "late" -> "non_submitters";
            default -> null;
        };
    }

    private String history(SubmissionsRequest request, ToolContext context) throws Exception {
        if (ToolSupport.notBlank(request.unitName()) || ToolSupport.notBlank(request.unitId())
                || ToolSupport.notBlank(request.periodId())) {
            throw new IllegalArgumentException("view=history không dùng unitName/unitId/periodId. "
                    + "Hãy truyền kpiName (hoặc kpiId) để chọn KPI; muốn xem theo đơn vị thì dùng "
                    + "view=non_submitters.");
        }

        // Gom theo TÊN: KPI lặp theo tuần trùng tên -> lấy MỌI bản (trong phạm vi) rồi gộp bài nộp,
        // để không phụ thuộc việc model chọn đúng một bản. kpiId (nếu có) vẫn cho phép nhắm 1 bản.
        List<UUID> kpiIds = new ArrayList<>();
        if (ToolSupport.notBlank(request.kpiId())) {
            UUID id = support.parseId(request.kpiId(), "KPI (kpiId)", "search (entityType=kpi)");
            support.guardDisambiguation("kpi", id, "KPI", context);
            support.validateKpiAccess(id, context);
            kpiIds.add(id);
        } else if (ToolSupport.notBlank(request.kpiName())) {
            for (Map<String, Object> m : support.kpiMatchPool(request.kpiName(), support.getOrgId(context))) {
                UUID id = UUID.fromString(String.valueOf(m.get("id")));
                if (support.hasKpiAccess(id, context)) kpiIds.add(id);
            }
            if (kpiIds.isEmpty()) {
                Map<String, Object> empty = new LinkedHashMap<>();
                empty.put("total", 0);
                empty.put("submissions", List.of());
                empty.put("message", "Không tìm thấy KPI tên '" + request.kpiName().trim() + "' trong phạm vi của bạn.");
                return support.respond(context, "get_submissions", empty);
            }
        } else {
            throw new IllegalArgumentException("view=history cần kpiName hoặc kpiId.");
        }

        if (ToolSupport.notBlank(request.userId())) {
            support.parseId(request.userId(), "người dùng (userId)", "search (entityType=user)");
        }
        Map<String, Object> response = orgUnitStatisticService.getSubmissionHistory(
                kpiIds, request.userId(), request.status(),
                request.startDate(), request.endDate(),
                request.limit() != null ? request.limit() : 20);
        return support.respond(context, "get_submissions", response);
    }

    private String nonSubmitters(SubmissionsRequest request, ToolContext context) throws Exception {
        if (ToolSupport.notBlank(request.kpiName()) || ToolSupport.notBlank(request.kpiId())
                || ToolSupport.notBlank(request.status())) {
            throw new IllegalArgumentException("view=non_submitters không dùng kpiName/kpiId/status — "
                    + "nó đếm trên toàn bộ KPI của đơn vị. Muốn xem bài nộp của MỘT KPI thì dùng view=history.");
        }

        UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
        if (u.clarification() != null) return support.respond(context, "get_submissions", u.clarification());

        if (ToolSupport.notBlank(request.periodId())) {
            support.parseId(request.periodId(), "kỳ KPI (periodId)", "search (entityType=period)");
        }
        Map<String, Object> response = orgUnitStatisticService.getNonSubmitters(
                u.id(), request.periodId(),
                request.startDate(), request.endDate(),
                request.limit() != null ? request.limit() : 20);
        return support.respond(context, "get_submissions", response);
    }
}
