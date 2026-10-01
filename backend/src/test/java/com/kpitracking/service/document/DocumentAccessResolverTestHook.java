package com.kpitracking.service.document;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Cho test ở package khác (IT truy hồi) dựng {@link DocumentAccess} trên cây đơn vị giả, không cần DB. */
public final class DocumentAccessResolverTestHook {

    private DocumentAccessResolverTestHook() {}

    /** @param memberships đơn vị → tập quyền của vai trò ở đơn vị đó */
    public static DocumentAccess compute(UUID orgId, UUID userId, Map<UUID, Set<String>> memberships, Map<UUID, String> unitPaths) {
        List<DocumentAccessResolver.Membership> ms = memberships.entrySet().stream()
                .map(e -> new DocumentAccessResolver.Membership(unitPaths.get(e.getKey()), e.getValue()))
                .toList();
        return DocumentAccessResolver.compute(orgId, userId, ms, unitPaths);
    }
}
