package com.kpitracking.tool;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Cross-request, in-memory cache holding the tool outputs produced during the most
 * recent chat turn of each conversation. The chat request ({@code AiService}) starts a
 * turn and the tools append their JSON results; the separate {@code /ai/followups}
 * request then reads this real, structured data to ground follow-up question generation
 * (instead of a truncated natural-language answer, which led to fabricated numbers).
 *
 * <p>Single-instance only — not shared across backend replicas. Bounded by a max number
 * of tracked conversations (LRU-by-time eviction) and a max number of tool entries per
 * conversation, so it cannot grow unbounded.
 */
@Component
public class FollowupContextStore {

    private static final int MAX_CONVERSATIONS = 500;
    private static final int MAX_ENTRIES_PER_CONVERSATION = 12;
    private static final long TTL_MILLIS = 30 * 60 * 1000L; // 30 minutes

    @Getter
    public static class ToolResult {
        private final String toolName;
        private final String json;

        public ToolResult(String toolName, String json) {
            this.toolName = toolName;
            this.json = json;
        }
    }

    private static class Bucket {
        final List<ToolResult> results = new ArrayList<>();
        /** Kết quả tool của LƯỢT hiện tại, key = toolName + tham số — để gọi trùng không chạy lại. */
        final Map<String, String> callCache = new ConcurrentHashMap<>();
        volatile long updatedAt = Instant.now().toEpochMilli();
        volatile boolean disambiguating = false;
        /** Lựa chọn để người dùng bấm khi tool yêu cầu làm rõ (thay cho việc gõ lại tên). */
        volatile List<ClarificationOption> clarificationOptions = List.of();
    }

    /** Một lựa chọn hiển thị thành nút bấm: {@code label} để đọc, {@code value} là câu sẽ gửi lại. */
    @Getter
    public static class ClarificationOption {
        private final String label;
        private final String value;

        public ClarificationOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    private final Map<String, Bucket> store = new ConcurrentHashMap<>();

    /** Clear this conversation's bucket so it only ever holds the latest turn's tools. */
    public void startTurn(String conversationId) {
        if (conversationId == null) return;
        evictStale();
        Bucket b = new Bucket();
        store.put(conversationId, b);
    }

    public void append(String conversationId, String toolName, String json) {
        if (conversationId == null || json == null) return;
        Bucket b = store.computeIfAbsent(conversationId, k -> new Bucket());
        synchronized (b.results) {
            // Model hay gọi lặp cùng một tool trong một lượt -> chỉ giữ kết quả KHÁC nhau, để
            // ngân sách ký tự của prompt gợi ý không bị các bản sao y hệt chiếm chỗ.
            boolean duplicate = b.results.stream()
                    .anyMatch(r -> r.getToolName().equals(toolName) && r.getJson().equals(json));
            if (!duplicate && b.results.size() < MAX_ENTRIES_PER_CONVERSATION) {
                b.results.add(new ToolResult(toolName, json));
            }
        }
        b.updatedAt = Instant.now().toEpochMilli();
    }

    /** Kết quả đã có của đúng lời gọi này (cùng tool + cùng tham số) trong lượt hiện tại, nếu có. */
    public String getCachedCall(String conversationId, String cacheKey) {
        if (conversationId == null || cacheKey == null) return null;
        Bucket b = store.get(conversationId);
        return b != null ? b.callCache.get(cacheKey) : null;
    }

    /** Ghi nhớ kết quả của lời gọi này trong phạm vi LƯỢT hiện tại (startTurn sẽ xoá). */
    public void cacheCall(String conversationId, String cacheKey, String json) {
        if (conversationId == null || cacheKey == null || json == null) return;
        Bucket b = store.get(conversationId);
        if (b != null) b.callCache.put(cacheKey, json);
    }

    /** Latest turn's tool outputs for a conversation, or an empty list. */
    public List<ToolResult> get(String conversationId) {
        if (conversationId == null) return List.of();
        Bucket b = store.get(conversationId);
        if (b == null) return List.of();
        if (Instant.now().toEpochMilli() - b.updatedAt > TTL_MILLIS) {
            store.remove(conversationId);
            return List.of();
        }
        synchronized (b.results) {
            return new ArrayList<>(b.results);
        }
    }

    /** Mark this conversation as being in disambiguation mode (user must choose). */
    public void markDisambiguating(String conversationId) {
        markDisambiguating(conversationId, List.of());
    }

    /**
     * Như trên, kèm các lựa chọn LẤY TỪ CHÍNH DỮ LIỆU TOOL để client hiện thành nút bấm.
     * Nhờ vậy người dùng chọn đúng một mục có thật thay vì gõ lại tên (dễ sai/mơ hồ tiếp).
     */
    public void markDisambiguating(String conversationId, List<ClarificationOption> options) {
        if (conversationId == null) return;
        Bucket b = store.computeIfAbsent(conversationId, k -> new Bucket());
        b.disambiguating = true;
        if (options != null && !options.isEmpty()) b.clarificationOptions = List.copyOf(options);
        b.updatedAt = Instant.now().toEpochMilli();
    }

    /** Lựa chọn đang chờ người dùng bấm của lượt hiện tại (rỗng nếu không phải lượt hỏi lại). */
    public List<ClarificationOption> getClarificationOptions(String conversationId) {
        if (conversationId == null) return List.of();
        Bucket b = store.get(conversationId);
        return b != null ? b.clarificationOptions : List.of();
    }

    /** Check if this conversation is awaiting user disambiguation. */
    public boolean isDisambiguating(String conversationId) {
        if (conversationId == null) return false;
        Bucket b = store.get(conversationId);
        return b != null && b.disambiguating;
    }

    private void evictStale() {
        long now = Instant.now().toEpochMilli();
        store.entrySet().removeIf(e -> now - e.getValue().updatedAt > TTL_MILLIS);
        if (store.size() > MAX_CONVERSATIONS) {
            store.entrySet().stream()
                    .sorted((a, b) -> Long.compare(a.getValue().updatedAt, b.getValue().updatedAt))
                    .limit(store.size() - MAX_CONVERSATIONS)
                    .map(Map.Entry::getKey)
                    .toList()
                    .forEach(store::remove);
        }
    }
}
