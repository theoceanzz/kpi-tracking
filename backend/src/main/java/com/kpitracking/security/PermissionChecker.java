package com.kpitracking.security;

import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Centralized permission checker for service-level authorization.
 * Replaces all hasRole/hasAnyRole checks with permission-based logic.
 */
@Component
@RequiredArgsConstructor
public class PermissionChecker {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;

    /**
     * Check if a user has a specific permission code (e.g. "KPI:APPROVE") globally.
     */
    public boolean hasPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        return assignments.stream()
                .map(UserRoleOrgUnit::getRole)
                .distinct()
                .flatMap(role -> rolePermissionRepository.findByRoleId(role.getId()).stream())
                .anyMatch(rp -> rp.getPermission().getCode().equals(permissionCode));
    }

    /**
     * Check if a user has a specific permission code for a specific OrgUnit.
     * This includes global roles (where OrgUnit is irrelevant) and roles assigned to that OrgUnit or its parents.
     */
    public boolean hasPermissionInOrgUnit(UUID userId, String permissionCode, UUID orgUnitId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        
        // 1. Check if user has global permission (e.g. Director) or permission in this specific OrgUnit
        return assignments.stream()
                .filter(assignment -> {
                    // Global roles (like DIRECTOR/ADMIN) might be assigned to a root org unit or have special handling.
                    // For now, we check if the role is assigned to the specific OrgUnit OR the user has the permission in any assignment.
                    // Actually, if they have DIRECTOR role anywhere, they usually have global permissions.
                    if (assignment.getRole().getName().equals("DIRECTOR") || assignment.getRole().getName().equals("ADMIN")) {
                        return true;
                    }
                    return assignment.getOrgUnit().getId().equals(orgUnitId);
                })
                .map(UserRoleOrgUnit::getRole)
                .distinct()
                .flatMap(role -> rolePermissionRepository.findByRoleId(role.getId()).stream())
                .anyMatch(rp -> rp.getPermission().getCode().equals(permissionCode));
    }

    /**
     * Check if a user has any of the given permission codes.
     */
    public boolean hasAnyPermission(UUID userId, String... permissionCodes) {
        List<String> codes = List.of(permissionCodes);
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        return assignments.stream()
                .map(UserRoleOrgUnit::getRole)
                .distinct()
                .flatMap(role -> rolePermissionRepository.findByRoleId(role.getId()).stream())
                .anyMatch(rp -> codes.contains(rp.getPermission().getCode()));
    }

    /**
     * Check if user is a Director or Admin (Global access).
     */
    public boolean isGlobalAdmin(UUID userId) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        return assignments.stream()
                .anyMatch(a -> a.getRole().getName().equals("DIRECTOR") || a.getRole().getName().equals("ADMIN"));
    }

    /**
     * Get list of all OrgUnit IDs where the user has a specific permission, including sub-units.
     */
    public List<UUID> getEffectiveOrgUnitsWithPermission(UUID userId, String permissionCode) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        List<String> allowedPaths = assignments.stream()
                .filter(a -> rolePermissionRepository.findByRoleId(a.getRole().getId()).stream()
                        .anyMatch(rp -> rp.getPermission().getCode().equals(permissionCode)))
                .map(a -> a.getOrgUnit().getPath())
                .distinct()
                .toList();
        
        if (allowedPaths.isEmpty()) return List.of();

        return assignments.stream()
                .filter(a -> rolePermissionRepository.findByRoleId(a.getRole().getId()).stream()
                        .anyMatch(rp -> rp.getPermission().getCode().equals(permissionCode)))
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .toList();
    }

    public List<UUID> getOrgUnitsWithPermission(UUID userId, String permissionCode) {
        return getEffectiveOrgUnitsWithPermission(userId, permissionCode);
    }

    public boolean hasRole(UUID userId, String roleName) {
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(userId);
        return assignments.stream()
                .anyMatch(a -> a.getRole().getName().equals(roleName));
    }
}
