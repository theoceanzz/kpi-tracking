package com.kpitracking.ai.memory;

import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.memory.ChatMemory;

import java.util.ArrayList;
import java.util.List;

/**
 * Bộ nhớ hội thoại của MỘT lượt: cửa sổ đã lưu + những gì lượt này sinh ra, chưa ghi đâu cả.
 *
 * <p><b>Vì sao không đưa kho DB thẳng cho {@code AiServices}.</b> AiServices ghi vào bộ nhớ ngay
 * khi có: câu hỏi trước lúc gọi model, rồi từng lời gọi tool, rồi câu trả lời. Ba hệ quả xấu:
 * <ul>
 *   <li>lượt lỗi giữa chừng để lại câu hỏi mồ côi trong DB (bản cũ phải có
 *       {@code ChatMemoryCleaner} để dọn);</li>
 *   <li>vòng hỏi lại (thiếu vế, mở thêm công cụ) hỏi CÙNG câu hai lần → DB có hai bản;</li>
 *   <li>tin gọi tool của lượt này bị lưu và lượt sau đọc lại kết quả tool đã cũ.</li>
 * </ul>
 * Ở đây mọi thứ AiServices thêm vào đi vào {@link #buffer}; DB chỉ nhận đúng một cặp hỏi–đáp
 * cuối cùng, ghi ở bước kết thúc bằng {@code ConversationMemoryStore.append} — CHỈ KHI đã có câu
 * trả lời. Đó là bất biến của bản cũ, và giữ nó không còn cần dọn dẹp gì.
 *
 * <p>{@link #clear()} chỉ xoá phần đệm — hỏi lại một vòng thì bắt đầu sạch, cửa sổ đã lưu giữ
 * nguyên. Không có đường nào từ lớp này xoá được dữ liệu trong DB.
 */
public final class TurnChatMemory implements ChatMemory {

    private final Object id;
    private final List<ChatMessage> window;
    private final List<ChatMessage> buffer = new ArrayList<>();
    private SystemMessage system;

    public TurnChatMemory(Object id, List<ChatMessage> window) {
        this.id = id;
        this.window = List.copyOf(window);
    }

    @Override
    public Object id() {
        return id;
    }

    @Override
    public synchronized void add(ChatMessage message) {
        // AiServices gửi lại SystemMessage ở mỗi lời gọi; giữ bản mới nhất và không đưa nó vào đệm.
        if (message instanceof SystemMessage s) {
            system = s;
            return;
        }
        buffer.add(message);
    }

    @Override
    public synchronized List<ChatMessage> messages() {
        List<ChatMessage> out = new ArrayList<>(1 + window.size() + buffer.size());
        if (system != null) out.add(system);
        out.addAll(window);
        out.addAll(buffer);
        return out;
    }

    @Override
    public synchronized void clear() {
        buffer.clear();
    }

    /** Có tin nào đã lưu từ các lượt trước không — để biết lượt này có ngữ cảnh hay không. */
    public boolean hasHistory() {
        return !window.isEmpty();
    }
}
