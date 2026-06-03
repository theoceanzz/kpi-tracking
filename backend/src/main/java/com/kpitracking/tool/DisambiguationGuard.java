package com.kpitracking.tool;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Per-turn (request-thread) guard preventing AI "detail" tools from silently
 * drilling into one of several same-named search results.
 *
 * A search tool "arms" the guard with the ambiguous candidate IDs for a given
 * entity type when it detects duplicates in the current turn. A detail tool then
 * refuses to proceed if the requested ID is armed, forcing the assistant to ask
 * the user to choose first.
 *
 * State is held in a ThreadLocal because all tool calls of a single chat turn run
 * synchronously on the same request thread. It MUST be cleared at the end of every
 * chat turn (see {@code AiService}) to avoid leaking across pooled threads.
 */
@Component
public class DisambiguationGuard {

    private final ThreadLocal<Map<String, Set<UUID>>> armed = ThreadLocal.withInitial(HashMap::new);

    public void arm(String entityType, Set<UUID> ids) {
        if (entityType == null || ids == null || ids.isEmpty()) return;
        armed.get().computeIfAbsent(entityType, k -> new HashSet<>()).addAll(ids);
    }

    public boolean isArmed(String entityType, UUID id) {
        if (entityType == null || id == null) return false;
        Set<UUID> ids = armed.get().get(entityType);
        return ids != null && ids.contains(id);
    }

    public void clear() {
        armed.remove();
    }
}
