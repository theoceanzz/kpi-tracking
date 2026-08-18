package com.kpitracking.tool;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * Cửa thoát hiểm của Router.
 *
 * <p>Đây là thứ biến <b>lỗi câm thành lỗi ồn</b> — lý do duy nhất khiến kiến trúc Router đáng lo.
 * Khi router chọn sai nhóm, model sẽ không có công cụ cần dùng; nếu không có tool này nó sẽ bịa ra
 * câu trả lời và không ai biết. Có nó rồi thì model báo "tôi thiếu công cụ", {@code AiService} nới
 * phạm vi ra toàn bộ nhóm đọc rồi gọi lại.
 *
 * <p>Trạng thái để trong ThreadLocal vì mọi lượt gọi tool của một lượt chat chạy đồng bộ trên cùng
 * một luồng request, giống {@link DisambiguationGuard}. PHẢI xoá ở cuối mỗi lượt.
 */
@Component
@Slf4j
public class EscapeHatchTool {

    private static final ThreadLocal<String> REQUESTED = new ThreadLocal<>();

    @Tool(name = "need_other_tools", description = "Gọi khi các công cụ hiện có KHÔNG đủ để trả lời "
            + "câu hỏi — ví dụ cần dữ liệu thuộc lĩnh vực khác hẳn. Nêu rõ trong reason là bạn cần gì. "
            + "Hệ thống sẽ mở thêm công cụ và hỏi lại bạn. TUYỆT ĐỐI không tự bịa câu trả lời khi thiếu "
            + "công cụ — hãy gọi tool này.")
    public String needOtherTools(NeedOtherToolsRequest request, ToolContext context) {
        String reason = request != null && request.reason() != null ? request.reason() : "(không nêu lý do)";
        REQUESTED.set(reason);
        log.info("Model báo thiếu công cụ: {}", reason);
        // Trả lời trung tính: lượt gọi lại (với đủ tool) mới là nơi sinh câu trả lời thật.
        return "{\"status\":\"WIDENING_TOOLSET\",\"message\":\"Đã ghi nhận. Hệ thống sẽ thử lại với đầy đủ công cụ.\"}";
    }

    public record NeedOtherToolsRequest(String reason) {}

    /** Model có xin thêm công cụ trong lượt này không. */
    public static boolean wasRequested() {
        return REQUESTED.get() != null;
    }

    public static String reason() {
        return REQUESTED.get();
    }

    public static void clear() {
        REQUESTED.remove();
    }
}
