package com.kpitracking.ai.memory;

import dev.langchain4j.memory.ChatMemory;
import dev.langchain4j.memory.chat.ChatMemoryProvider;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Nơi {@code AiServices} tìm bộ nhớ của một lượt theo {@code @MemoryId}.
 *
 * <p>{@code ChatMemoryProvider} của langchain4j chỉ nhận khoá, không nhận ngữ cảnh, nên lượt phải
 * đăng ký bộ nhớ của mình ở đây trước khi gọi agent và gỡ ra khi xong. Khoá là {@code turnId}
 * (ngẫu nhiên theo lượt) chứ không phải id hội thoại: hai lượt của cùng hội thoại chạy song song
 * (hai tab) thì mỗi lượt vẫn có phần đệm riêng.
 *
 * <p>Lượt không đăng ký (hoặc đã gỡ) nhận bộ nhớ rỗng tạm thời — không bao giờ nhận nhầm bộ nhớ
 * của lượt khác.
 */
@Component
public class TurnMemoryRegistry implements ChatMemoryProvider {

    private final Map<Object, TurnChatMemory> memories = new ConcurrentHashMap<>();

    public void register(String turnId, TurnChatMemory memory) {
        memories.put(turnId, memory);
    }

    public void unregister(String turnId) {
        if (turnId != null) memories.remove(turnId);
    }

    @Override
    public ChatMemory get(Object memoryId) {
        TurnChatMemory m = memories.get(memoryId);
        return m != null ? m : new TurnChatMemory(memoryId, java.util.List.of());
    }
}
