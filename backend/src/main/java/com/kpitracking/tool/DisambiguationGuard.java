package com.kpitracking.tool;

import io.micrometer.context.ThreadLocalAccessor;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-turn (request-thread) guard preventing AI "detail" tools from silently
 * drilling into one of several same-named search results.
 *
 * A search tool "arms" the guard with the ambiguous candidate IDs for a given
 * entity type when it detects duplicates in the current turn. A detail tool then
 * refuses to proceed if the requested ID is armed, forcing the assistant to ask
 * the user to choose first.
 *
 * State is held in a ThreadLocal and MUST be cleared at the end of every chat turn
 * (see {@code AiTurnPipeline}) to avoid leaking across pooled threads.
 *
 * <p>Cấu trúc bên trong an toàn nhiều luồng vì ở lượt streaming, Spring AI chạy vòng gọi tool trên
 * luồng của reactor chứ không phải luồng đang chạy chuỗi công đoạn; {@code TurnStatePropagation}
 * truyền THAM CHIẾU của bản đồ này sang luồng đó, nên nó bị ghi từ luồng này và đọc từ luồng kia.
 */
@Component
public class DisambiguationGuard {

    private final ThreadLocal<Map<String, Set<UUID>>> armed =
            ThreadLocal.withInitial(ConcurrentHashMap::new);

    public void arm(String entityType, Set<UUID> ids) {
        if (entityType == null || ids == null || ids.isEmpty()) return;
        armed.get().computeIfAbsent(entityType, k -> ConcurrentHashMap.newKeySet()).addAll(ids);
    }

    public boolean isArmed(String entityType, UUID id) {
        if (entityType == null || id == null) return false;
        Set<UUID> ids = armed.get().get(entityType);
        return ids != null && ids.contains(id);
    }

    public void clear() {
        armed.remove();
    }

    /**
     * Cho phép {@code TurnStatePropagation} mang bản đồ này sang luồng reactor.
     *
     * <p>Là hàm của thực thể chứ không phải lớp lồng tĩnh như các kho khác, vì {@code armed} là
     * trường của bean — có nhiều thực thể trong test và mỗi thực thể phải tự truyền phần của mình.
     */
    public ThreadLocalAccessor<Map<String, Set<UUID>>> accessor() {
        return new ThreadLocalAccessor<>() {
            @Override public Object key() { return KEY; }
            @Override public Map<String, Set<UUID>> getValue() { return armed.get(); }
            @Override public void setValue(Map<String, Set<UUID>> value) { armed.set(value); }
            @Override public void setValue() { armed.remove(); }
        };
    }

    public static final String KEY = "kpi.ai.disambiguation";
}
