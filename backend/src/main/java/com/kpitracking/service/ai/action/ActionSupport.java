package com.kpitracking.service.ai.action;

import com.kpitracking.service.ai.agent.AgentState;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import com.kpitracking.service.ai.action.PendingAction.Kind;
import com.kpitracking.tool.ToolSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phần dùng chung của các tool GHI: dựng lời mời xác nhận và cất nó đi.
 *
 * <p>Cùng vai trò với {@code FormFillSupport} ở nhóm tool điền form — gom vào một chỗ những thứ mà
 * bốn tool hành động đều phải làm giống hệt nhau, để mỗi tool chỉ còn phần riêng của nó là "giải
 * câu hỏi thành danh sách đối tượng".
 *
 * <p><b>Việc quan trọng nhất ở đây là nói cho MODEL biết rằng chưa có gì xảy ra.</b> Nếu payload
 * trả về chỉ là "ok" thì model sẽ tường thuật "đã duyệt xong 7 bài nộp" — một câu trôi chảy và hoàn
 * toàn sai, vì chưa byte nào xuống cơ sở dữ liệu. Cùng loại lỗi mà khối "TỆP CỦA NGƯỜI DÙNG" phải
 * chặn: model suy diễn trạng thái từ việc tool chạy trót lọt.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ActionSupport {

    private final PendingActionStore store;
    private final ToolSupport support;

    /** Trần số mục nêu trong một lời mời — dài hơn thì người dùng không đọc nổi để mà thẩm định. */
    private static final int MAX_ITEMS = 25;

    /**
     * Dựng lời mời xác nhận, cất vào kho, và trả cho model một payload nói rõ là CHƯA làm gì.
     *
     * @param items danh sách đã giải nghĩa xong; rỗng nghĩa là không có gì để làm và ta nói thẳng
     *              điều đó thay vì mời xác nhận một việc trống
     */
    public String propose(ToolContext context, String toolName, Kind kind, String title,
                          Decision decision, String note, List<Item> items) throws Exception {
        if (items == null || items.isEmpty()) {
            return support.respond(context, toolName, Map.of(
                    "nothingToDo", true,
                    "message", "Không có mục nào khớp yêu cầu này.",
                    "guidance", "Nói với người dùng là không tìm thấy mục nào cần xử lý. "
                            + "ĐỪNG mời họ xác nhận và ĐỪNG nói đã làm xong."));
        }

        if (items.size() > MAX_ITEMS) {
            return support.respond(context, toolName, Map.of(
                    "tooMany", true,
                    "found", items.size(),
                    "limit", MAX_ITEMS,
                    "message", "Có " + items.size() + " mục, nhiều hơn mức " + MAX_ITEMS
                            + " mà một lần xác nhận nên gánh.",
                    "guidance", "Bảo người dùng thu hẹp lại (theo đơn vị, theo kỳ, hoặc theo người) "
                            + "rồi hỏi lại. ĐỪNG tự chia nhỏ rồi làm từng phần."));
        }

        PendingAction action = new PendingAction(UUID.randomUUID().toString(), kind, title,
                decision, note, items, Instant.now());

        AgentState state = AgentState.from(context);
        if (state == null) {
            // Không có chỗ mang lời mời về cho người dùng thì mời cũng vô nghĩa — nói thẳng còn hơn
            // để model hứa một cái nút không bao giờ hiện ra.
            log.warn("Không có AgentState, bỏ lời mời xác nhận cho {}", kind);
            return support.toolError(toolName,
                    new IllegalStateException("Chưa mở được lời mời xác nhận cho thao tác này."));
        }
        state.setPendingAction(action);
        store.put(action, userIdOf(context));

        log.info("Đã dựng lời mời xác nhận {} gồm {} mục (chưa ghi gì)", kind, items.size());
        return support.respond(context, toolName, previewForModel(action));
    }

    /**
     * Payload cho model đọc.
     *
     * <p>Cố ý KHÔNG gồm id: model không cần chúng để nói chuyện, mà nêu ra thì có ngày nó đọc một
     * dãy UUID cho người dùng nghe. Danh sách đầy đủ kèm id đi thẳng tới client qua
     * {@code AiChatResponse.pendingAction}.
     */
    private static Map<String, Object> previewForModel(PendingAction action) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", "CHỜ NGƯỜI DÙNG XÁC NHẬN");
        out.put("title", action.title());
        out.put("count", action.count());
        out.put("items", action.items().stream()
                .map(i -> i.detail() == null || i.detail().isBlank()
                        ? i.label() : i.label() + " (" + i.detail() + ")")
                .toList());
        if (action.note() != null && !action.note().isBlank()) out.put("note", action.note());
        // Hai câu này là phần chống model tường thuật sai. Nói cả điều PHẢI làm lẫn điều CẤM nói.
        out.put("guidance", "CHƯA có gì được thay đổi trong hệ thống. Hãy tóm tắt cho người dùng "
                + "biết sắp làm gì với bao nhiêu mục, rồi bảo họ bấm nút xác nhận ngay dưới câu trả "
                + "lời của bạn.");
        out.put("forbidden", "TUYỆT ĐỐI không nói 'đã duyệt', 'đã gửi', 'đã xong' hay bất kỳ câu nào "
                + "hàm ý việc đã hoàn tất — nó chỉ chạy SAU khi người dùng bấm xác nhận.");
        return out;
    }

    /** Chủ của lời mời. Thiếu thì trả null và kho sẽ từ chối mọi lần xác nhận — an toàn hơn đoán. */
    private static UUID userIdOf(ToolContext context) {
        Object v = context == null || context.getContext() == null
                ? null : context.getContext().get("userId");
        return v instanceof UUID id ? id : null;
    }
}
