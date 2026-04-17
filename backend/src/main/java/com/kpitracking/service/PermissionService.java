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
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        return rolePermissionRepository.findByRoleId(roleId).stream()
                .map(rp -> permissionMapper.toResponse(rp.getPermission()))
                .toList();
    }

    @Transactional
    public void assignPermissionsToRole(UUID roleId, AssignPermissionRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        List<Permission> permissions = permissionRepository.findAllByIdIn(request.getPermissionIds());
        if (permissions.size() != request.getPermissionIds().size()) {
            throw new ResourceNotFoundException("Some permissions not found");
        }

        for (Permission permission : permissions) {
            if (!rolePermissionRepository.existsByRoleIdAndPermissionId(roleId, permission.getId())) {
                RolePermission rolePermission = RolePermission.builder()
                        .role(role)
                        .permission(permission)
                        .build();
                rolePermissionRepository.save(rolePermission);
            }
        }
    }

    @Transactional
    public void removePermissionFromRole(UUID roleId, UUID permissionId) {
        if (!rolePermissionRepository.existsByRoleIdAndPermissionId(roleId, permissionId)) {
            throw new ResourceNotFoundException("RolePermission not found");
        }
        rolePermissionRepository.deleteByRoleIdAndPermissionId(roleId, permissionId);
    }
}
