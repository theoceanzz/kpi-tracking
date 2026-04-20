package com.kpitracking.service;

import com.kpitracking.dto.request.userrole.AssignRoleRequest;
import com.kpitracking.dto.response.userrole.UserRoleOrgUnitResponse;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Role;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.UserRoleOrgUnitMapper;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.RoleRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserRoleService {

    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitMapper mapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public UserRoleOrgUnitResponse assignRole(AssignRoleRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getUserId()));
        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new ResourceNotFoundException("Role", "id", request.getRoleId()));
        OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));

        if (!orgUnit.getAllowedRoles().isEmpty() && !orgUnit.getAllowedRoles().contains(role)) {
            throw new com.kpitracking.exception.BusinessException("Vai trò này không được phép gán trong đơn vị này");
        }

        if (userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(
                request.getUserId(), request.getRoleId(), request.getOrgUnitId())) {
            throw new DuplicateResourceException("Người dùng đã có vai trò này tại đơn vị này");
        }

        UserRoleOrgUnit assignment = UserRoleOrgUnit.builder()
                .user(user)
                .role(role)
                .orgUnit(orgUnit)
                .assignedBy(getCurrentUser())
                .expiresAt(request.getExpiresAt())
                .build();

        assignment = userRoleOrgUnitRepository.save(assignment);
        return mapper.toResponse(assignment);
    }

    @Transactional
    public void revokeRole(UUID userId, UUID roleId, UUID orgUnitId) {
        if (!userRoleOrgUnitRepository.existsByUserIdAndRoleIdAndOrgUnitId(userId, roleId, orgUnitId)) {
            throw new ResourceNotFoundException("Không tìm thấy thông tin phân quyền của người dùng");
        }
        userRoleOrgUnitRepository.deleteByUserIdAndRoleIdAndOrgUnitId(userId, roleId, orgUnitId);
    }

    @Transactional(readOnly = true)
    public List<UserRoleOrgUnitResponse> getUserRoles(UUID userId) {
        userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return mapper.toResponseList(userRoleOrgUnitRepository.findByUserId(userId));
    }

    @Transactional(readOnly = true)
    public List<UserRoleOrgUnitResponse> getUsersByOrgUnit(UUID orgUnitId) {
        orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", orgUnitId));
        return mapper.toResponseList(userRoleOrgUnitRepository.findByOrgUnitId(orgUnitId));
    }
}
