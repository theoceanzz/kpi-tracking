package com.kpitracking.security;

import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RolePermissionRepository;
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
     * Check if a user has a specific permission code for a specific OrgUnit.
     * Supports inheritance: permission in a parent unit applies to all child units.
     * SYSTEM:ADMIN permission acts as a super-permission within its scope (unit + children).
     */
    public boolean hasPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        if (assignments.isEmpty()) return false;

        OrgUnit targetUnit = orgUnitRepository.findById(orgUnitId).orElse(null);
        if (targetUnit == null) return false;

        Map<UUID, Set<String>> rolePerms = getPermissionsByRole(assignments);

        return assignments.stream()
                .filter(a -> targetUnit.getPath().startsWith(a.getOrgUnit().getPath())) // Target is in subtree of assignment
                .anyMatch(a -> {
                    Set<String> perms = rolePerms.getOrDefault(a.getRole().getId(), Collections.emptySet());
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
}
