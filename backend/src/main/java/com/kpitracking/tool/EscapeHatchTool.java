package com.kpitracking.tool;

import io.micrometer.context.ThreadLocalAccessor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicReference;

/**
 * Cửa thoát hiểm của Router.
 *
 * <p>Đây là thứ biến <b>lỗi câm thành lỗi ồn</b> — lý do duy nhất khiến kiến trúc Router đáng lo.
 * Khi router chọn sai nhóm, model sẽ không có công cụ cần dùng; nếu không có tool này nó sẽ bịa ra
 * câu trả lời và không ai biết. Có nó rồi thì model báo "tôi thiếu công cụ", {@code AiService} nới
 * phạm vi ra toàn bộ nhóm đọc rồi gọi lại.
 *
 * <p>Trạng thái để trong ThreadLocal, giống {@link DisambiguationGuard}. PHẢI xoá ở cuối mỗi lượt.
 *
 * <p><b>Vì sao là hộp chứa chứ không giữ thẳng lý do.</b> Ở lượt streaming, tool chạy trên luồng
 * reactor chứ không phải luồng đang chạy chuỗi công đoạn; {@code TurnStatePropagation} truyền được
 * THAM CHIẾU hộp chứa sang luồng đó. Giữ thẳng giá trị thì luồng kia chỉ ghi vào bản sao của nó,
 * {@code EscapeHatchStage} không bao giờ thấy — tức cửa thoát hiểm im lặng ngừng hoạt động, đúng
 * cái lỗi câm mà nó sinh ra để chống.
 */
@Component
@Slf4j
public class EscapeHatchTool {

    private static final ThreadLocal<AtomicReference<String>> REQUESTED =
            ThreadLocal.withInitial(AtomicReference::new);

    @Tool(name = "need_other_tools", description = "Gọi khi các công cụ hiện có KHÔNG đủ để trả lời "
            + "câu hỏi — ví dụ cần dữ liệu thuộc lĩnh vực khác hẳn. Nêu rõ trong reason là bạn cần gì. "
            + "Hệ thống sẽ mở thêm công cụ và hỏi lại bạn. TUYỆT ĐỐI không tự bịa câu trả lời khi thiếu "
            + "công cụ — hãy gọi tool này.")
    public String needOtherTools(NeedOtherToolsRequest request, ToolContext context) {
        String reason = request != null && request.reason() != null ? request.reason() : "(không nêu lý do)";
        REQUESTED.get().set(reason);
        log.info("Model báo thiếu công cụ: {}", reason);
        // Trả lời trung tính: lượt gọi lại (với đủ tool) mới là nơi sinh câu trả lời thật.
        return "{\"status\":\"WIDENING_TOOLSET\",\"message\":\"Đã ghi nhận. Hệ thống sẽ thử lại với đầy đủ công cụ.\"}";
    }

    public record NeedOtherToolsRequest(String reason) {}

    /** Model có xin thêm công cụ trong lượt này không. */
    public static boolean wasRequested() {
        return REQUESTED.get().get() != null;
    }

    public static String reason() {
        return REQUESTED.get().get();
    }

    public static void clear() {
        REQUESTED.remove();
    }

    /** Cho phép {@code TurnStatePropagation} mang hộp chứa này sang luồng reactor. */
    public static final class Accessor implements ThreadLocalAccessor<AtomicReference<String>> {
        public static final String KEY = "kpi.ai.escape-hatch";
        @Override public Object key() { return KEY; }
        @Override public AtomicReference<String> getValue() { return REQUESTED.get(); }
        @Override public void setValue(AtomicReference<String> value) { REQUESTED.set(value); }
        @Override public void setValue() { REQUESTED.remove(); }
    }
}
