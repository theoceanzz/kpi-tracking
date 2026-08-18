package com.kpitracking.tool;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Ghi lại các tool đã chạy THÀNH CÔNG trong một lượt hỏi.
 *
 * <p>Vì sao không dùng {@link FollowupContextStore}: kho đó khoá theo {@code conversationId}, nên
 * lượt hỏi không có bộ nhớ hội thoại thì nó không ghi gì — đúng lúc cần nhất. Bộ đếm này hoạt động
 * với mọi lượt.
 *
 * <p>Chỉ đếm lời gọi thành công: tool lỗi đi qua {@code ToolSupport.toolError(...)} chứ không qua
 * {@code respond(...)}. Chủ đích — model thử lấy dữ liệu, thất bại, rồi vẫn đưa ra con số thì đó
 * chính là bịa, phải bị bắt.
 *
 * <p>Trạng thái để trong ThreadLocal vì mọi lời gọi tool của một lượt chạy đồng bộ trên cùng luồng
 * request, giống {@link DisambiguationGuard} và {@link EscapeHatchTool}. PHẢI xoá ở cuối mỗi lượt —
 * {@code AiTurnPipeline} lo việc đó trong khối {@code finally}.
 */
@Component
public class ToolCallTracker {

    private static final ThreadLocal<List<String>> CALLS = ThreadLocal.withInitial(ArrayList::new);

    public static void record(String toolName) {
        if (toolName != null) CALLS.get().add(toolName);
    }

    /** Tên các tool đã chạy trong lượt, theo thứ tự gọi. */
    public static List<String> calls() {
        return List.copyOf(CALLS.get());
    }

    public static boolean anyCalled() {
        return !CALLS.get().isEmpty();
    }

    public static void clear() {
        CALLS.remove();
    }
}
