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
     * Check if a user has a specific permission code (e.g. "KPI:APPROVE").
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
}
