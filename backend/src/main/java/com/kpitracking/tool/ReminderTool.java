package com.kpitracking.tool;

import com.kpitracking.service.OrgUnitStatisticService;
import com.kpitracking.service.ai.action.ActionSupport;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.SendRemindersRequest;
import com.kpitracking.tool.ToolSupport.UnitRef;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

import static com.kpitracking.tool.ActionToolSupport.*;

/**
 * Gửi nhắc nhở cho người được giao chỉ tiêu mà chưa nộp báo cáo.
 *
 * <p><b>Tool này KHÔNG ghi gì</b> — nó dựng lời mời xác nhận rồi dừng; việc ghi do
 * {@code PendingActionExecutor} làm sau khi người dùng bấm. Xem {@code PendingAction}.
 *
 * <p>Là bean RIÊNG chứ không gộp với các tool ghi khác: mỗi việc đòi một quyền khác nhau, mà
 * {@code ToolCallbacks.from(bean)} lấy mọi {@code @Tool} của một bean cùng lúc.
 */
@Component
@RequiredArgsConstructor
public class ReminderTool {

    /** Lấy rộng hơn trần hiển thị để {@code ActionSupport} còn báo được "nhiều quá, thu hẹp lại". */
    private static final int FETCH_LIMIT = 100;

    private final OrgUnitStatisticService statisticService;
    private final ToolSupport support;
    private final ActionSupport actions;

    @Tool(name = "send_reminders", description =
            "Gửi nhắc nhở cho những người ĐƯỢC GIAO chỉ tiêu mà CHƯA nộp báo cáo. Đây là thao tác "
            + "GHI (gửi thông báo thật): tool chỉ chuẩn bị danh sách và chờ người dùng bấm xác nhận, "
            + "KHÔNG tự gửi. Thu hẹp bằng unitName và periodName. "
            + "Mỗi dòng là một cặp (người, chỉ tiêu) — một người thiếu nhiều chỉ tiêu sẽ có nhiều dòng.")
    public String sendReminders(SendRemindersRequest request, ToolContext context) {
        try {
            UnitRef unit = support.resolveUnit(request.unitId(), request.unitName(), context);
            if (unit.clarification() != null) {
                return support.respond(context, "send_reminders", unit.clarification());
            }
            UUID periodId = support.resolvePeriodId(request.periodName(), context);

            List<Object[]> pairs = statisticService.getMissingSubmissionPairs(
                    unit.id(), periodId == null ? null : periodId.toString(), FETCH_LIMIT);

            // [kpiId, kpiName, userId, userFullName] — xem getMissingSubmissionPairs.
            List<Item> items = pairs.stream()
                    .map(r -> new Item((UUID) r[0], (UUID) r[2],
                            nameOr(str(r[3])) + " — " + str(r[1]),
                            "chưa nộp"))
                    .toList();

            // Không có chiều từ chối: nhắc thì chỉ có nhắc.
            return actions.propose(context, "send_reminders", Kind.SEND_REMINDER,
                    "Gửi nhắc nhở cho " + items.size() + " lượt chưa nộp"
                            + suffix(request.unitName(), request.periodName()),
                    null, request.note(), items);
        } catch (Exception e) {
            return support.toolError("send_reminders", e);
        }
    }

}
