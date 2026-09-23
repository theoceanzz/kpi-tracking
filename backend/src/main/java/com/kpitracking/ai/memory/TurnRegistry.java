package com.kpitracking.ai.memory;

import com.kpitracking.service.ai.AiTurn;
import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sổ đăng ký lượt đang chạy, tra theo {@code @MemoryId}.
 *
 * <p>Mô-đun agentic và {@code AiServices} chỉ đưa cho {@code ChatMemoryProvider} và
 * {@code systemMessageProvider} một KHOÁ, không đưa ngữ cảnh — nên lượt phải đăng ký chính nó ở
 * đây trước khi gọi agent và gỡ ra khi xong. Khoá là {@code turnId} (= {@code memoryId} của scope,
 * ngẫu nhiên theo lượt) chứ không phải id hội thoại: hai lượt của cùng hội thoại chạy song song (hai
 * tab) thì mỗi lượt vẫn có phần đệm riêng.
 *
 * <p>Có hai kiểu mục: cả lượt ({@link #register(AiTurn)} — agent chính) hoặc chỉ bộ nhớ
 * ({@link #register(String, TurnChatMemory)} — agent gợi ý KPI, không có {@code AiTurn}).
 * Khoá không đăng ký (hoặc đã gỡ) nhận bộ nhớ rỗng tạm thời — không bao giờ nhận nhầm của lượt khác.
 */
@Component
public class TurnRegistry implements ChatMemoryProvider {

    private record Entry(AiTurn turn, TurnChatMemory memory) {}

    private final Map<Object, Entry> entries = new ConcurrentHashMap<>();

    /** Đăng ký cả lượt: khoá là {@code turn.getTurnId()}, bộ nhớ là {@code turn.getMemory()}. */
    public void register(AiTurn turn) {
        entries.put(turn.getTurnId(), new Entry(turn, turn.getMemory()));
    }

    public void register(String id, TurnChatMemory memory) {
        entries.put(id, new Entry(null, memory));
    }

    public void unregister(String id) {
        if (id != null) entries.remove(id);
    }

    /** Lượt đang chạy dưới khoá này; ném nếu không có — gọi agent chính mà không có lượt là lỗi lập trình. */
    public AiTurn turn(Object memoryId) {
        Entry e = entries.get(memoryId);
        if (e == null || e.turn() == null) {
            throw new IllegalStateException("Không có lượt nào đăng ký dưới khoá " + memoryId);
        }
        return e.turn();
    }

    @Override
    public ChatMemory get(Object memoryId) {
        Entry e = entries.get(memoryId);
        return e != null && e.memory() != null ? e.memory() : new TurnChatMemory(memoryId, List.of());
    }
}
