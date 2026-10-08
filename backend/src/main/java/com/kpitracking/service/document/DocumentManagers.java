package com.kpitracking.service.document;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.enums.DocumentScope;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Ai là "người quản lý" của một phạm vi tài liệu — người nhận nhắc rà soát và người duyệt đề xuất đưa tài liệu lên
 * (docs/DOCUMENTS_DESIGN.md §16). Cùng luật quyền với {@link DocumentAccessResolver}:
 * <ul>
 *   <li>cá nhân → chính chủ;</li>
 *   <li>đơn vị → người có {@code DOCUMENT:MANAGE_UNIT} ở CẤP GẦN NHẤT (đơn vị đó, không có thì đơn vị cha gần nhất) —
 *       không báo cả chuỗi lên tới giám đốc;</li>
 *   <li>công ty → người có {@code DOCUMENT:MANAGE_COMPANY}, lấy cấp cao nhất có người (thường là đơn vị gốc).</li>
 * </ul>
 * Bỏ tài khoản tạm dừng / đã xoá. Trần {@value #MAX} người để một thao tác không sinh hàng trăm thông báo.
 */
@Component
public class DocumentManagers {

    static final int MAX = 20;

    private final UserRoleOrgUnitRepository assignments;
    private final OrgUnitRepository orgUnits;
    private final UserRepository users;

    public DocumentManagers(UserRoleOrgUnitRepository assignments, OrgUnitRepository orgUnits, UserRepository users) {
        this.assignments = assignments;
        this.orgUnits = orgUnits;
        this.users = users;
    }

    public List<User> of(UUID orgId, DocumentScope scope, UUID unitId, UUID ownerId) {
        return of(scope, unitId, ownerId, unitsOf(orgId));
    }

    /** Như trên, dùng cây đơn vị đã nạp sẵn (job xử lý nhiều tài liệu cùng tổ chức). */
    public List<User> of(DocumentScope scope, UUID unitId, UUID ownerId, Map<UUID, OrgUnit> units) {
        return switch (scope) {
            case PERSONAL -> ownerId == null ? List.of()
                    : users.findById(ownerId).filter(u -> !u.isPausedAccount()).map(List::of).orElse(List.of());
            case UNIT -> {
                OrgUnit unit = unitId == null ? null : units.get(unitId);
                if (unit == null) yield List.of();
                List<String> chain = units.values().stream().map(OrgUnit::getPath)
                        .filter(p -> unit.getPath().startsWith(p)).toList();
                yield level(chain, DocumentAccessResolver.MANAGE_UNIT, true);
            }
            case COMPANY -> level(units.values().stream().map(OrgUnit::getPath).toList(),
                    DocumentAccessResolver.MANAGE_COMPANY, false);
        };
    }

    public Map<UUID, OrgUnit> unitsOf(UUID orgId) {
        Map<UUID, OrgUnit> out = new HashMap<>();
        if (orgId != null) orgUnits.findSubtree("/", orgId).forEach(u -> out.put(u.getId(), u));
        return out;
    }

    /**
     * Người có quyền ở MỘT cấp: {@code deepest} = đơn vị sâu nhất (gần tài liệu nhất), ngược lại = nông nhất.
     */
    private List<User> level(Collection<String> paths, String permission, boolean deepest) {
        if (paths.isEmpty()) return List.of();
        Map<String, Map<UUID, User>> byPath = new HashMap<>();
        for (Object[] row : assignments.findUsersWithPermissionAtOrgUnitPaths(paths, permission)) {
            User u = (User) row[1];
            if (u == null || u.getDeletedAt() != null || u.isPausedAccount()) continue;
            byPath.computeIfAbsent((String) row[0], k -> new LinkedHashMap<>()).put(u.getId(), u);
        }
        Comparator<String> byDepth = Comparator.comparingInt(String::length);
        return byPath.keySet().stream()
                .sorted(deepest ? byDepth.reversed() : byDepth)
                .findFirst()
                .map(p -> byPath.get(p).values().stream().limit(MAX).toList())
                .orElse(List.of());
    }
}
