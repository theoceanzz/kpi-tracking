package com.kpitracking.service;

import com.kpitracking.dto.request.permission.AssignPermissionRequest;
import com.kpitracking.dto.response.permission.PermissionResponse;
import com.kpitracking.entity.Permission;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.RolePermission;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.PermissionMapper;
import com.kpitracking.repository.PermissionRepository;
import com.kpitracking.repository.RolePermissionRepository;
import com.kpitracking.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PermissionService {

    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleRepository roleRepository;
    private final PermissionMapper permissionMapper;

    @Transactional(readOnly = true)
    public List<PermissionResponse> listAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(permissionMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> getPermissionsByRole(UUID roleId) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Vai trò", "id", roleId));

        return rolePermissionRepository.findByRoleId(roleId).stream()
                .map(rp -> permissionMapper.toResponse(rp.getPermission()))
                .toList();
    }

    @Transactional
    public void assignPermissionsToRole(UUID roleId, AssignPermissionRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        if (Boolean.TRUE.equals(role.getIsSystem())) {
             throw new com.kpitracking.exception.BusinessException("Không thể chỉnh sửa quyền cho vai trò hệ thống");
        }

        List<Permission> newPermissions = permissionRepository.findAllByIdIn(request.getPermissionIds());
        if (newPermissions.size() != request.getPermissionIds().size()) {
            throw new ResourceNotFoundException("Một số quyền hạn không tìm thấy");
        }

        // Get currently assigned permissions
        List<RolePermission> currentRolePermissions = rolePermissionRepository.findByRoleId(roleId);
        java.util.Set<UUID> currentPermissionIds = currentRolePermissions.stream()
                .map(rp -> rp.getPermission().getId())
                .collect(java.util.stream.Collectors.toSet());

        java.util.Set<UUID> newPermissionIds = new java.util.HashSet<>(request.getPermissionIds());

        // 1. Remove permissions no longer selected
        currentRolePermissions.stream()
                .filter(rp -> !newPermissionIds.contains(rp.getPermission().getId()))
                .forEach(rolePermissionRepository::delete);

        // 2. Add new permissions
        newPermissions.stream()
                .filter(p -> !currentPermissionIds.contains(p.getId()))
                .forEach(p -> {
                    RolePermission rp = RolePermission.builder()
                            .role(role)
                            .permission(p)
                            .build();
                    rolePermissionRepository.save(rp);
                });
    }

    @Transactional
    public void removePermissionFromRole(UUID roleId, UUID permissionId) {
        if (!rolePermissionRepository.existsByRoleIdAndPermissionId(roleId, permissionId)) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin quyền hạn của vai trò");
        }
        rolePermissionRepository.deleteByRoleIdAndPermissionId(roleId, permissionId);
    }
}
