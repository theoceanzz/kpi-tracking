package com.kpitracking.service;

import com.kpitracking.dto.request.role.CreateRoleRequest;
import com.kpitracking.dto.request.role.UpdateRoleRequest;
import com.kpitracking.dto.response.role.RoleResponse;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.RoleMapper;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final RoleMapper roleMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        if (roleRepository.existsByName(request.getName())) {
            throw new DuplicateResourceException("Role", "name", request.getName());
        }

        Role role = Role.builder()
                .name(request.getName())
                .createdBy(getCurrentUser())
                .build();

        if (request.getParentRoleId() != null) {
            Role parentRole = roleRepository.findById(request.getParentRoleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Role", "id", request.getParentRoleId()));
            role.setParentRole(parentRole);
        }

        role = roleRepository.save(role);
        return roleMapper.toResponse(role);
    }

    @Transactional
    public RoleResponse updateRole(UUID roleId, UpdateRoleRequest request) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        if (Boolean.TRUE.equals(role.getIsSystem())) {
            throw new BusinessException("Cannot modify system role: " + role.getName());
        }

        if (request.getName() != null) {
            if (!request.getName().equals(role.getName()) && roleRepository.existsByName(request.getName())) {
                throw new DuplicateResourceException("Role", "name", request.getName());
            }
            role.setName(request.getName());
        }

        if (request.getParentRoleId() != null) {
            if (request.getParentRoleId().equals(roleId)) {
                throw new BusinessException("Role cannot be its own parent");
            }
            Role parentRole = roleRepository.findById(request.getParentRoleId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parent Role", "id", request.getParentRoleId()));
            role.setParentRole(parentRole);
        }

        role = roleRepository.save(role);
        return roleMapper.toResponse(role);
    }

    @Transactional
    public void deleteRole(UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));

        if (Boolean.TRUE.equals(role.getIsSystem())) {
            throw new BusinessException("Cannot delete system role: " + role.getName());
        }

        role.setDeletedAt(Instant.now());
        roleRepository.save(role);
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roleRepository.findAllByDeletedAtIsNull().stream()
                .map(roleMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse getRole(UUID roleId) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", roleId));
        return roleMapper.toResponse(role);
    }
}
