package com.kpitracking.security;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Centralized permission checker for service-level authorization.
 * 100% permission-based — NO hardcoded role names.
 * 
 * Key design:
 * - isGlobalAdmin() checks for SYSTEM:ADMIN permission at the root unit.
 * - hasPermissionInOrgUnit() supports hierarchy inheritance and scope-aware SYSTEM:ADMIN.
 * - All role names are user-defined and dynamic.
 */
@Component
@RequiredArgsConstructor
public class PermissionChecker {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;

    /**
     * Internal helper to fetch assignments and their associated permission codes.
     */
    private Map<UUID, Set<String>> getPermissionsByRole(List<UserRoleOrgUnit> assignments) {
        Set<UUID> roleIds = assignments.stream()
                .map(a -> a.getRole().getId())
                .collect(Collectors.toSet());
        
        if (roleIds.isEmpty()) return Collections.emptyMap();
        
        List<RolePermission> rolePermissions = rolePermissionRepository.findByRoleIdIn(roleIds);
        
        return rolePermissions.stream()
                .collect(Collectors.groupingBy(
                        rp -> rp.getRole().getId(),
                        Collectors.mapping(rp -> rp.getPermission().getCode(), Collectors.toSet())
                ));
    }

    /**
     * Check if a user has a specific permission code (e.g. "KPI:APPROVE") globally.
     * This checks if ANY assigned role has the permission.
     */
    public boolean hasPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .map(a -> a.getRole().getId())
                .distinct()
                .anyMatch(roleId -> {
                    Set<String> perms = rolePerms.getOrDefault(roleId, Collections.emptySet());
                    return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
                });
    }

    /**
     * Check if a user has any of the given permission codes globally.
     */
    public boolean hasAnyPermission(UUID userId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        return assignments.stream()
                .map(a -> a.getRole().getId())
                .distinct()
                .anyMatch(roleId -> {
                    Set<String> perms = rolePerms.getOrDefault(roleId, Collections.emptySet());
                    if (perms.contains("SYSTEM:ADMIN")) return true;
                    return perms.stream().anyMatch(targetCodes::contains);
                });
    }

    /**
     * Check if a user has a specific permission code for a specific OrgUnit.
     * Supports inheritance: permission in a parent unit applies to all child units.
     * SYSTEM:ADMIN permission acts as a super-permission within its scope (unit + children).
     */
    public boolean hasPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        return hasAnyPermissionInOrgUnit(userId, orgUnitId, permissionCode);
    }

    /**
     * Như {@link #hasPermissionInOrgUnit} nhưng đòi thêm người đó phải là TRƯỞNG (rank 0)
     * của đơn vị đó hoặc của một đơn vị cha — phó (rank 1) không tính.
     *
     * Dành cho những việc mà quyền thôi chưa đủ, phải đúng người đứng đầu ký: chấm hạnh
     * kiểm là một. SYSTEM:ADMIN vẫn đi qua như mọi chỗ khác, nếu không thì quản trị viên
     * không có vai trò trong cây tổ chức sẽ tự khoá mình ra ngoài.
     */
    public boolean hasLeaderPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .anyMatch(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                    if (perms.contains("SYSTEM:ADMIN")) return true;
                    Integer rank = a.getRole().getRank();
                    return rank != null && rank == 0 && perms.contains(permissionCode);
                });
    }

    /**
     * Check if a user has any of the specific permission codes for a specific OrgUnit.
     */
    public boolean hasAnyPermissionInOrgUnit(UUID userId, UUID orgUnitId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .anyMatch(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                    return perms.contains("SYSTEM:ADMIN") || perms.stream().anyMatch(targetCodes::contains);
                });
    }

    /**
     * Check if user has global admin access (SYSTEM:ADMIN permission at the root unit).
     */
    public boolean isGlobalAdmin(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .filter(a -> a.getOrgUnit().getParent() == null) // Root unit only
                .anyMatch(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                    return perms.contains("SYSTEM:ADMIN");
                });
    }

    /**
     * Check if a user is a platform-level super admin (cross-org access).
     */
    public boolean isPlatformAdmin(String email) {
        return userRepository.findByEmail(email)
                .map(u -> Boolean.TRUE.equals(u.getIsPlatformAdmin()))
                .orElse(false);
    }

    /**
     * Get list of all OrgUnit IDs where the user has a specific permission.
     * This returns the "base" units where the permission is explicitly assigned.
     * Callers should handle sub-unit logic (e.g. via path LIKE) if needed.
     */
    public List<UUID> getEffectiveOrgUnitsWithPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return Collections.emptyList();

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .filter(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                    return perms.contains(permissionCode) || perms.contains("SYSTEM:ADMIN");
                })
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();
    }

    public List<UUID> getOrgUnitsWithPermission(UUID userId, String permissionCode) {
        return getEffectiveOrgUnitsWithPermission(userId, permissionCode);
    }

    /**
     * Get list of all OrgUnit IDs where the user has any of the specific permissions.
     */
    public List<UUID> getOrgUnitsWithAnyPermission(UUID userId, String... permissionCodes) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return Collections.emptyList();

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);
        Set<String> targetCodes = Set.of(permissionCodes);

        return assignments.stream()
                .filter(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
                    return perms.contains("SYSTEM:ADMIN") || perms.stream().anyMatch(targetCodes::contains);
                })
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();
    }

    /**
     * Phạm vi xem KPI suy ra từ membership của một user, tách theo rank.
     * <p>
     * Vai trò quản lý (rank 0/1) nhìn được cả cây con của đơn vị được gán; nhân viên
     * (rank 2 hoặc chưa đặt) chỉ nhìn đúng đơn vị đó. Việc tách này là cần thiết vì
     * {@code UserService.assignToUnitAndImmediateParent} tự sinh thêm một membership
     * nhân viên ở đơn vị CHA — với tổ chức hai cấp, đơn vị cha chính là gốc công ty,
     * nên nếu mở rộng cây con cho cả membership nhân viên thì mọi người sẽ thấy KPI
     * của tất cả đơn vị anh em.
     */
    public record KpiVisibilityScope(List<UUID> managerUnitIds, List<UUID> memberUnitIds) {

        /** UUID không trỏ tới bản ghi nào, dùng để giữ mệnh đề IN hợp lệ khi danh sách rỗng. */
        private static final UUID NO_MATCH = new UUID(0L, 0L);

        public boolean isEmpty() {
            return managerUnitIds.isEmpty() && memberUnitIds.isEmpty();
        }

        /** JPQL không nhận {@code IN ()} rỗng — thay bằng UUID không khớp gì. */
        public List<UUID> managerUnitIdsForQuery() {
            return managerUnitIds.isEmpty() ? List.of(NO_MATCH) : managerUnitIds;
        }

        public List<UUID> memberUnitIdsForQuery() {
            return memberUnitIds.isEmpty() ? List.of(NO_MATCH) : memberUnitIds;
        }
    }

    /**
     * Split a user's memberships into manager scope (subtree-wide) and member scope (exact unit).
     */
    public KpiVisibilityScope getKpiVisibilityScope(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);

        List<UUID> managerUnitIds = assignments.stream()
                .filter(a -> isManagerRank(a.getRole().getRank()))
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();

        List<UUID> memberUnitIds = assignments.stream()
                .filter(a -> !isManagerRank(a.getRole().getRank()))
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();

        return new KpiVisibilityScope(managerUnitIds, memberUnitIds);
    }

    /** Rank rỗng được coi là nhân viên, khớp mặc định của {@link #getMinRankInOrgUnit}. */
    private static boolean isManagerRank(Integer rank) {
        return rank != null && rank <= 1;
    }

    /**
     * Get the minimum (best/highest) rank of a user in a specific OrgUnit.
     * Considers inheritance: rank in a parent unit applies to all child units.
     * Ranks: 0 (Head), 1 (Deputy), 2 (Staff).
     */
    public int getMinRankInOrgUnit(UUID userId, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return 2; // Default to staff rank

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return 2;

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath())) // Target is in subtree of assignment
                .map(a -> a.getRole().getRank())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);
    }

    /**
     * Get the minimum (best/highest) level of a user in a specific OrgUnit.
     * Levels: 0 (Group), 1 (Region), 2 (Company), 3 (Department), 4 (Team).
     */
    public int getMinLevelInOrgUnit(UUID userId, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return 4; // Default to lowest level

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return 4;

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .map(a -> a.getRole().getLevel())
                .filter(Objects::nonNull)
                .min(Integer::compare)
                .orElse(4);
    }

    /**
     * Khoá sắp xếp thâm niên trong một OrgUnit: {@code level * 1000 + rank}.
     * NHỎ hơn = cấp cao hơn. Gộp 2 trục (level, rank) thành 1 số để so sánh
     * "ai trên ai" chỉ bằng một phép so sánh thay vì lặp lại biểu thức lexicographic.
     */
    public int seniorityKeyInOrgUnit(UUID userId, UUID orgUnitId) {
        return getMinLevelInOrgUnit(userId, orgUnitId) * 1000 + getMinRankInOrgUnit(userId, orgUnitId);
    }

    /** Tên vai trò tốt nhất (cấp cao nhất) của user áp dụng cho OrgUnit này. */
    public String getBestRoleNameInOrgUnit(UUID userId, UUID orgUnitId) {
        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return null;

        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath()))
                .min(Comparator
                        .comparingInt((UserRoleOrgUnit a) -> a.getRole().getLevel() != null ? a.getRole().getLevel() : 4)
                        .thenComparingInt(a -> a.getRole().getRank() != null ? a.getRole().getRank() : 2))
                .map(a -> a.getRole().getName())
                .orElse(null);
    }
}
