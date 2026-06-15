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
        volatile long updatedAt = Instant.now().toEpochMilli();
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
            if (b.results.size() < MAX_ENTRIES_PER_CONVERSATION) {
                b.results.add(new ToolResult(toolName, json));
            }
        }
        b.updatedAt = Instant.now().toEpochMilli();
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
