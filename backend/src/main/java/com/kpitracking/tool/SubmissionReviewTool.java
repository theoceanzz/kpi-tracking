package com.kpitracking.tool;

import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.service.KpiSubmissionService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ReviewSubmissionsRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import com.kpitracking.tool.ToolSupport.UserRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Duyệt hoặc từ chối bản nộp KPI — tool GHI đầu tiên của trợ lý.
 *
 * <p><b>Tool này KHÔNG ghi gì.</b> Nó giải câu hỏi thành một danh sách bản nộp cụ thể rồi dừng lại
 * chờ người dùng bấm xác nhận; việc ghi do {@code PendingActionExecutor} làm sau đó. Xem
 * {@code PendingAction} để biết vì sao ranh giới này tồn tại.
 *
 * <p><b>Lọc mặc định là CHỜ DUYỆT.</b> "Duyệt bài nộp của Team Backend" gần như luôn có nghĩa là
 * những bài đang chờ, không phải duyệt lại cả những bài người khác đã duyệt xong. Lấy rộng rồi để
 * người dùng tự bỏ chọn là sai hướng: danh sách dài thì họ bấm xác nhận mà không đọc.
 *
 * <p><b>Lọc theo tên người nộp đi qua {@code ToolSupport.resolveUser}</b> — cùng luật khớp tên với
 * đơn vị và KPI, nên tên trùng thì HỎI LẠI chứ không tự chọn. Chọn nhầm ở đây là duyệt bài của
 * người khác.
 *
 * <p><b>Phạm vi dữ liệu đi qua hai lớp.</b> {@code resolveUnit} chặn đơn vị ngoài cây con ngay tại
 * đây, và {@code getSubmissions} còn tự lọc theo các đơn vị người dùng có quyền duyệt. Lớp thứ ba
 * là chính {@code reviewSubmission} lúc thực thi — nó kiểm lại quyền và cấp bậc cho TỪNG bản nộp.
 */
@Component
@RequiredArgsConstructor
public class SubmissionReviewTool {

    /** Trần khi hỏi kho; cắt bớt còn để {@code ActionSupport} báo "nhiều quá, thu hẹp lại". */
    private static final int FETCH_LIMIT = 100;

    private static final DateTimeFormatter DAY =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

    private final KpiSubmissionService submissionService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "review_submissions", description =
            "Duyệt hoặc TỪ CHỐI bản nộp KPI của nhân viên. Đây là thao tác GHI: tool chỉ chuẩn bị "
            + "danh sách và chờ người dùng bấm xác nhận, KHÔNG tự thực hiện. "
            + "decision=APPROVE để duyệt, REJECT để từ chối (từ chối thì PHẢI có note nêu lý do). "
            + "Thu hẹp bằng unitName (đơn vị), periodName (tên kỳ, vd 'Tháng 6/2026') và "
            + "personName (tên người NỘP). "
            + "Không nêu gì thì lấy các bản CHỜ DUYỆT của đơn vị bạn. "
            + "Dùng khi người dùng bảo duyệt/phê duyệt/từ chối bài nộp hoặc báo cáo KPI.")
    public String reviewSubmissions(ReviewSubmissionsRequest request, ToolContext context) {
        try {
            Decision decision = decisionOf(request.decision());
            String note = request.note();
            if (decision == Decision.REJECT && !ToolSupport.notBlank(note)) {
                throw new IllegalArgumentException(
                        "Từ chối bản nộp thì PHẢI có note nêu lý do. Hỏi người dùng lý do rồi gọi lại.");
            }

            UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (unit.clarification() != null) {
                return support.respond(context, "review_submissions", unit.clarification());
            }

            UUID periodId = support.resolvePeriodId(request.periodName(), context);

            // Tên người trùng thì HỎI LẠI chứ không tự chọn: chọn nhầm ở đây là duyệt bài của người
            // khác, và không có nút hoàn tác.
            UserRef person = support.resolveUser(null, request.personName(), context);
            if (person.clarification() != null) {
                return support.respond(context, "review_submissions", person.clarification());
            }

            // Chỉ bản CHỜ DUYỆT: xem ghi chú ở đầu lớp.
            PageResponse<SubmissionResponse> page = submissionService.getSubmissions(
                    0, FETCH_LIMIT, SubmissionStatus.PENDING, periodId, null, person.id(),
                    unit.id(), "createdAt", "asc");

            List<Item> items = page.getContent().stream()
                    .map(SubmissionReviewTool::toItem)
                    .toList();

            return actions.propose(context, "review_submissions", Kind.SUBMISSION_REVIEW,
                    title(decision, items.size(), unit, request), decision, note, items);
        } catch (Exception e) {
            return support.toolError("review_submissions", e);
        }
    }

    /**
     * Một dòng người dùng đọc để thẩm định.
     *
     * <p>Nêu TÊN người nộp và TÊN chỉ tiêu, kèm giá trị đạt so với mục tiêu — đúng ba thứ cần để
     * quyết định có duyệt hay không. Thiếu chúng thì "duyệt 7 bản nộp" là bấm mù.
     */
    private static Item toItem(SubmissionResponse s) {
        StringBuilder detail = new StringBuilder();
        if (s.getKpiPeriod() != null && s.getKpiPeriod().getName() != null) {
            detail.append("kỳ ").append(s.getKpiPeriod().getName());
        } else if (s.getPeriodStart() != null) {
            detail.append("từ ").append(DAY.format(s.getPeriodStart()));
        }
        if (s.getActualValue() != null) {
            if (detail.length() > 0) detail.append(", ");
            detail.append("đạt ").append(trim(s.getActualValue()));
            if (s.getTargetValue() != null) detail.append('/').append(trim(s.getTargetValue()));
            if (ToolSupport.notBlank(s.getUnit())) detail.append(' ').append(s.getUnit());
        } else if (ToolSupport.notBlank(s.getQualitativeLevelName())) {
            if (detail.length() > 0) detail.append(", ");
            detail.append("mức ").append(s.getQualitativeLevelName());
        }
        String who = ToolSupport.notBlank(s.getSubmittedByName()) ? s.getSubmittedByName() : "(không rõ)";
        return new Item(s.getId(), null, who + " — " + s.getKpiCriteriaName(), detail.toString());
    }

    private static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    private static String title(Decision decision, int count, UnitRef unit,
                               ReviewSubmissionsRequest request) {
        String verb = decision == Decision.APPROVE ? "Duyệt" : "Từ chối";
        StringBuilder sb = new StringBuilder(verb).append(' ').append(count).append(" bản nộp");
        if (ToolSupport.notBlank(request.unitName())) sb.append(" của ").append(request.unitName());
        if (ToolSupport.notBlank(request.personName())) sb.append(" — ").append(request.personName());
        if (ToolSupport.notBlank(request.periodName())) sb.append(", kỳ ").append(request.periodName());
        return sb.toString();
    }

    /** Không đoán: thiếu hoặc sai thì bắt model nói rõ, vì hai chiều cho kết quả ngược nhau. */
    private static Decision decisionOf(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(
                    "Thiếu decision. Truyền APPROVE để duyệt hoặc REJECT để từ chối.");
        }
        String v = raw.trim().toUpperCase(java.util.Locale.ROOT);
        if (v.equals("APPROVE") || v.equals("APPROVED")) return Decision.APPROVE;
        if (v.equals("REJECT") || v.equals("REJECTED")) return Decision.REJECT;
        throw new IllegalArgumentException(
                "decision không hợp lệ: '" + raw + "'. Chỉ nhận APPROVE hoặc REJECT.");
    }
}
