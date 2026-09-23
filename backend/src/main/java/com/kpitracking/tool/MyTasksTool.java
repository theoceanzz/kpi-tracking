package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.AdjustmentRequestResponse;
import com.kpitracking.dto.response.kpi.CycleUnitStatusResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiCycle;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.CycleUnitEvalStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.KpiAdjustmentService;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.KpiCycleEvaluationService;
import com.kpitracking.service.KpiSubmissionService;
import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.MyTasksRequest;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.invocation.InvocationParameters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * "Hôm nay tôi cần làm gì?" — gom mọi thứ đang chờ người quản lý thành một câu trả lời.
 *
 * <p>Không có dữ liệu mới: năm ô là năm truy vấn mà các tool riêng lẻ đã dùng (duyệt bài nộp, duyệt
 * chỉ tiêu, duyệt điều chỉnh, người chưa nộp, đợt đánh giá). Cái mới là câu hỏi đầu ngày của trưởng
 * đơn vị không phải hỏi năm lần — và mỗi ô chỉ ra tool xử lý tiếp, để model đi thẳng tới việc.
 *
 * <p>Mỗi ô chỉ hỏi khi người dùng CÓ QUYỀN tương ứng (đúng quyền của tool xử lý). Không có quyền
 * thì ô ghi "không có quyền" chứ không ném — một ô hỏng không được làm mất bốn ô còn lại.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MyTasksTool {

    private static final int FETCH_LIMIT = 100;
    private static final int SAMPLE = 5;

    private final KpiSubmissionService submissionService;
    private final KpiCriteriaService kpiCriteriaService;
    private final KpiAdjustmentService adjustmentService;
    private final OrgUnitStatisticService orgUnitStatisticService;
    private final KpiCycleEvaluationService cycleEvaluationService;
    private final CycleEvaluationTool cycleEvaluationTool;
    private final PermissionChecker permissionChecker;
    private final ToolSupport support;

    @Tool(name = "get_my_tasks", value = "VIỆC ĐANG CHỜ người dùng xử lý, gom một lần: bài nộp chờ duyệt, chỉ tiêu KPI "
            + "chờ duyệt, yêu cầu điều chỉnh chờ, người chưa nộp báo cáo, đơn vị chưa chốt đợt đánh giá. "
            + "Dùng cho 'hôm nay tôi cần làm gì', 'còn gì đang chờ tôi', 'tổng hợp việc'. Mỗi ô có count, vài dòng "
            + "mẫu và nextTool = tool để xử lý tiếp (review_submissions, review_kpi_criteria, ...). "
            + "Mặc định là đơn vị hiện tại của người dùng; truyền unitName để xem đơn vị con. "
            + "KHÔNG thay các tool chi tiết: muốn danh sách đầy đủ hay xử lý thì gọi nextTool.")
    public String getMyTasks(MyTasksRequest request, InvocationParameters context) {
        try {
            ToolSupport.UnitRef u = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (u.clarification() != null) return support.respond(context, "get_my_tasks", u.clarification());
            UUID unitId = u.id();
            Object rawUser = context.get("userId"); // get() là generic: String.valueOf(get()) chọn nhầm bản char[]
            UUID userId = rawUser == null ? null : UUID.fromString(rawUser.toString());
            UUID periodId = support.resolvePeriodId(request.periodName(), context);

            List<Map<String, Object>> buckets = new ArrayList<>();
            buckets.add(bucket("pendingSubmissions", "Bài nộp chờ duyệt", "review_submissions", userId, "SUBMISSION:REVIEW", () -> {
                PageResponse<SubmissionResponse> page = submissionService.getSubmissions(
                        0, FETCH_LIMIT, SubmissionStatus.PENDING, periodId, null, null, unitId, "createdAt", "asc");
                return page.getContent().stream().map(s -> s.getSubmittedByName() + " — " + s.getKpiCriteriaName()
                        + (s.getKpiPeriod() != null && s.getKpiPeriod().getName() != null ? " (" + s.getKpiPeriod().getName() + ")" : "")).toList();
            }));
            buckets.add(bucket("pendingKpiCriteria", "Chỉ tiêu KPI chờ duyệt", "review_kpi_criteria", userId, "KPI:APPROVE_CRITERIA", () -> {
                PageResponse<KpiCriteriaResponse> page = kpiCriteriaService.getKpiCriteria(
                        0, FETCH_LIMIT, KpiStatus.PENDING_APPROVAL, unitId, null, null, periodId,
                        null, null, null, "createdAt", "asc", null, null, null, true, null, null, null, null);
                return page.getContent().stream().map(k -> k.getName()
                        + (k.getOrgUnitName() != null ? " — " + k.getOrgUnitName() : "")).toList();
            }));
            buckets.add(bucket("pendingAdjustments", "Yêu cầu điều chỉnh KPI chờ duyệt", "review_kpi_adjustments", userId, "KPI:APPROVE_ADJUSTMENT", () -> {
                PageResponse<AdjustmentRequestResponse> page = adjustmentService.getAllRequests(
                        0, FETCH_LIMIT, AdjustmentStatus.PENDING, unitId, periodId);
                return page.getContent().stream().map(a -> a.getRequesterName() + " — " + a.getKpiCriteriaName()).toList();
            }));
            buckets.add(bucket("nonSubmitters", "Người chưa nộp báo cáo", "send_reminders", userId, "REMINDER:SEND", () -> {
                Map<String, Object> res = orgUnitStatisticService.getNonSubmitters(
                        unitId, periodId == null ? null : periodId.toString(), null, null, FETCH_LIMIT);
                Object rows = res.get("nonSubmitters");
                List<String> out = new ArrayList<>();
                if (rows instanceof List<?> list) {
                    for (Object r : list) {
                        if (r instanceof Map<?, ?> m) out.add(m.get("fullName") + " (thiếu " + m.get("missingKpiCount") + " KPI)");
                    }
                }
                return out;
            }));
            buckets.add(bucket("unfinalizedCycleUnits", "Đơn vị chưa chốt đợt đánh giá", "get_cycle_evaluation", userId, "CYCLE_EVAL:VIEW", () -> {
                KpiCycle cycle = cycleEvaluationTool.resolveCycle(null, support.getOrgId(context));
                if (cycle == null) return List.of();
                List<CycleUnitStatusResponse> rows = cycleEvaluationService.listUnitStatuses(cycle.getId());
                return rows.stream().filter(r -> r.getStatus() != CycleUnitEvalStatus.FINALIZED)
                        .map(r -> r.getOrgUnitName() + " (đợt " + cycle.getName() + ")").toList();
            }));

            int total = buckets.stream().mapToInt(b -> b.get("count") instanceof Integer i ? i : 0).sum();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("unitName", ToolSupport.notBlank(request.unitName()) ? request.unitName().trim() : "đơn vị hiện tại");
            out.put("period", ToolSupport.notBlank(request.periodName()) ? request.periodName().trim() : "mọi kỳ");
            out.put("totalPending", total);
            out.put("buckets", buckets);
            if (total == 0) out.put("message", "Không có việc nào đang chờ trong phạm vi này.");
            return support.respond(context, "get_my_tasks", out);
        } catch (Exception e) {
            return support.toolError("get_my_tasks", e);
        }
    }

    /** Một ô: kiểm quyền → chạy truy vấn → đếm + mẫu; lỗi của ô nào nằm trong ô đó. */
    private Map<String, Object> bucket(String kind, String label, String nextTool, UUID userId,
                                       String permission, Supplier<List<String>> rows) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("kind", kind);
        b.put("label", label);
        b.put("nextTool", nextTool);
        if (userId == null || !permissionChecker.hasPermission(userId, permission)) {
            b.put("count", 0);
            b.put("skipped", "không có quyền " + permission);
            return b;
        }
        try {
            List<String> all = rows.get();
            b.put("count", all.size());
            b.put("samples", all.subList(0, Math.min(SAMPLE, all.size())));
        } catch (Exception e) {
            log.warn("get_my_tasks: ô {} lỗi: {}", kind, e.getMessage());
            b.put("count", 0);
            b.put("error", e.getMessage());
        }
        return b;
    }
}
