package com.kpitracking.tool;

import com.kpitracking.service.ai.action.PendingAction;
import com.kpitracking.service.ai.action.PendingActionExecutor;
import com.kpitracking.service.ai.action.PendingActionStore;
import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.tool.OrgUnitStatisticToolRequests.ConfirmActionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Chạy thao tác GHI đang chờ, khi người dùng xác nhận bằng LỜI thay vì bấm nút.
 *
 * <p><b>Vì sao cần.</b> Trước đây nút là đường xác nhận duy nhất. Người dùng quên bấm, rời trang,
 * quay lại gõ "xác nhận duyệt" — trợ lý không hiểu đó là lời đồng ý nên chạy lại tool và dựng ra
 * một lời mời THỨ HAI cho đúng việc đó. Lời mời cũ nằm lại vô chủ, còn người dùng vẫn chưa duyệt
 * được gì.
 *
 * <p><b>Vì sao là TOOL chứ không phải một công đoạn bắt chữ.</b> Nhận ra "người dùng đang đồng ý"
 * là việc hiểu ngôn ngữ, không phải việc của biểu thức chính quy: bắt chữ "xác nhận" sẽ nổ nhầm ở
 * <i>"xác nhận duyệt giúp tôi các KPI kỳ test3"</i> — một yêu cầu MỚI chứ không phải lời đồng ý.
 *
 * <p><b>Chỉ được gửi cho model khi thật sự có lời mời đang treo</b> ({@code RouteNode} hỏi
 * {@link PendingActionStore#hasPending}) — cùng khuôn với tool điền form, vốn chỉ xuất hiện khi
 * người dùng đang mở đúng form đó. Model không nhìn thấy thì không gọi nhầm được.
 *
 * <p>Không đòi quyền riêng: việc ghi thật vẫn đi qua {@link PendingActionExecutor} rồi tới các dịch
 * vụ nghiệp vụ, nơi quyền và cấp bậc được kiểm lại cho TỪNG mục.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ConfirmActionTool {

    private final PendingActionStore store;
    private final PendingActionExecutor executor;
    private final ToolSupport support;

    @Tool(name = "confirm_pending_action", description =
            "Chạy thao tác GHI mà bạn vừa chuẩn bị và đang chờ người dùng xác nhận. "
            + "CHỈ gọi khi người dùng ĐỒNG Ý với việc vừa được chuẩn bị — ví dụ họ nói "
            + "'xác nhận', 'đồng ý', 'ok duyệt đi', 'làm đi'. "
            + "KHÔNG gọi khi họ nêu một yêu cầu MỚI (dù câu đó có chữ 'duyệt'): lúc ấy dùng đúng "
            + "tool của việc đó để chuẩn bị một lời mời mới. "
            + "Sau khi tool này chạy, dữ liệu ĐÃ thay đổi thật — hãy báo lại đúng số mục đã làm "
            + "được và nêu rõ những mục không làm được kèm lý do.")
    public String confirmPendingAction(ConfirmActionRequest request, ToolContext context) {
        try {
            UUID userId = userIdOf(context);
            String conversationId = support.getConversationId(context);

            PendingAction action = store.takeLatestFor(userId, conversationId);
            if (action == null) {
                // Hết hạn, đã chạy rồi, hoặc lời mời thuộc cuộc trò chuyện khác. Nói thẳng và bảo
                // model chuẩn bị lại — tuyệt đối không đoán xem người dùng định duyệt cái gì.
                return support.respond(context, "confirm_pending_action", Map.of(
                        "executed", false,
                        "reason", "EXPIRED_OR_NONE",
                        "message", "Không còn thao tác nào đang chờ xác nhận trong cuộc trò chuyện này.",
                        "guidance", "Nói với người dùng là lời mời đã hết hiệu lực (quá hạn hoặc đã "
                                + "chạy rồi), rồi HỎI xem họ có muốn chuẩn bị lại không. ĐỪNG tự "
                                + "chạy lại và ĐỪNG nói đã làm xong."));
            }

            PendingActionExecutor.Outcome outcome = executor.execute(action);

            // Báo cho client biết lời mời NÀO vừa chạy, để nó tắt cái thẻ xác nhận cũ vẫn đang
            // nằm trên màn hình. Thiếu tín hiệu này thì người dùng xác nhận bằng chat xong vẫn
            // thấy nút, bấm vào lại nhận "không còn hiệu lực" — đúng nhưng nhìn như hỏng.
            AgentState state = AgentState.from(context);
            if (state != null) state.setConsumedActionId(action.id());
            log.info("Xác nhận bằng chat: {} — {} xong, {} hỏng",
                    action.kind(), outcome.succeeded().size(), outcome.failed().size());

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("executed", true);
            out.put("summary", executor.summarize(action, outcome));
            out.put("succeeded", outcome.succeeded().size());
            out.put("failed", outcome.failed().size());
            if (!outcome.failed().isEmpty()) out.put("failures", outcome.failed());
            out.put("guidance", "Việc đã CHẠY THẬT. Báo lại đúng con số ở trên. Có mục hỏng thì nêu "
                    + "rõ từng mục kèm lý do — im lặng bỏ qua phần hỏng là báo cáo sai, vì nó trông "
                    + "y hệt thành công.");
            return support.respond(context, "confirm_pending_action", out);
        } catch (Exception e) {
            return support.toolError("confirm_pending_action", e);
        }
    }

    /** Thiếu userId thì kho từ chối mọi lần lấy — an toàn hơn đoán. */
    private static UUID userIdOf(ToolContext context) {
        Object v = context == null || context.getContext() == null
                ? null : context.getContext().get("userId");
        return v instanceof UUID id ? id : null;
    }
}
