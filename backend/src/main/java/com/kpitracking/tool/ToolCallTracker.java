package com.kpitracking.tool;

import io.micrometer.context.ThreadLocalAccessor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

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
 * <p>Trạng thái để trong ThreadLocal, và PHẢI xoá ở cuối mỗi lượt — {@code AiTurnPipeline} lo việc
 * đó trong khối {@code finally}. Giống {@link DisambiguationGuard} và {@link EscapeHatchTool}.
 *
 * <p><b>Vì sao là danh sách an toàn nhiều luồng.</b> Ở lượt streaming, Spring AI chạy vòng gọi tool
 * trên luồng của reactor ({@code boundedElastic}) chứ không phải luồng đang chạy chuỗi công đoạn.
 * {@code TurnStatePropagation} truyền THAM CHIẾU danh sách này sang luồng đó, nên nó bị ghi từ luồng
 * này và đọc từ luồng kia. {@code ArrayList} ở đây là hỏng âm thầm.
 */
@Component
public class ToolCallTracker {

    private static final ThreadLocal<List<String>> CALLS =
            ThreadLocal.withInitial(CopyOnWriteArrayList::new);

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

    /** Cho phép {@code TurnStatePropagation} mang danh sách này sang luồng reactor. */
    public static final class Accessor implements ThreadLocalAccessor<List<String>> {
        public static final String KEY = "kpi.ai.tool-calls";
        @Override public Object key() { return KEY; }
        @Override public List<String> getValue() { return CALLS.get(); }
        @Override public void setValue(List<String> value) { CALLS.set(value); }
        @Override public void setValue() { CALLS.remove(); }
    }
}
