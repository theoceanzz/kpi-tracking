package com.kpitracking.tool;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import com.kpitracking.service.ai.agent.AgentState;

/**
 * Cửa thoát hiểm của Router.
 *
 * <p>Đây là thứ biến <b>lỗi câm thành lỗi ồn</b> — lý do duy nhất khiến kiến trúc Router đáng lo.
 * Khi router chọn sai nhóm, model sẽ không có công cụ cần dùng; nếu không có tool này nó sẽ bịa ra
 * câu trả lời và không ai biết. Có nó rồi thì model báo "tôi thiếu công cụ", {@code AiService} nới
 * phạm vi ra toàn bộ nhóm đọc rồi gọi lại.
 *
 * <p><b>Trạng thái đi qua {@code ToolContext}, không qua ThreadLocal.</b> Spring AI trao cùng một
 * map cho mọi lời gọi tool, nên cách này đúng ở bất kỳ luồng nào và không có gì phải dọn cuối lượt.
 * Bản trước để trong ThreadLocal kèm cả một tầng truyền tham chiếu sang luồng reactor — thứ đã hỏng
 * âm thầm đúng bốn lần. Xem {@code AgentState}.
 */
@Component
@Slf4j
public class EscapeHatchTool {

    @Tool(name = "need_other_tools", description = "Gọi khi các công cụ hiện có KHÔNG đủ để trả lời "
            + "câu hỏi — ví dụ cần dữ liệu thuộc lĩnh vực khác hẳn. Nêu rõ trong reason là bạn cần gì. "
            + "Hệ thống sẽ mở thêm công cụ và hỏi lại bạn. TUYỆT ĐỐI không tự bịa câu trả lời khi thiếu "
            + "công cụ — hãy gọi tool này.")
    public String needOtherTools(NeedOtherToolsRequest request, ToolContext context) {
        String reason = request != null && request.reason() != null ? request.reason() : "(không nêu lý do)";
        AgentState state = AgentState.from(context);
        if (state != null) state.setEscapeReason(reason);
        log.info("Model báo thiếu công cụ: {}", reason);
        // Trả lời trung tính: lượt gọi lại (với đủ tool) mới là nơi sinh câu trả lời thật.
        return "{\"status\":\"WIDENING_TOOLSET\",\"message\":\"Đã ghi nhận. Hệ thống sẽ thử lại với đầy đủ công cụ.\"}";
    }

    public record NeedOtherToolsRequest(String reason) {}
}
