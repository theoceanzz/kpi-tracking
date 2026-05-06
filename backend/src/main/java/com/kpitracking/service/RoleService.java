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
    private final com.kpitracking.repository.UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RoleMapper roleMapper;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    @Transactional
    public RoleResponse createRole(CreateRoleRequest request) {
        User user = getCurrentUser();
        // For simplicity, we take the organization from the user's first membership
        // In a production app, you might get this from a header or a selected context
        UUID orgId = userRoleOrgUnitRepository.findByUserId(user.getId())
                .stream()
                .map(uro -> uro.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId())
                .findFirst()
                .orElseThrow(() -> new BusinessException("User does not belong to any organization"));

        if (roleRepository.existsByNameIgnoreCaseAndOrganizationId(request.getName(), orgId)) {
            throw new DuplicateResourceException("Vai trò", "tên", request.getName());
        }

        Integer rank = request.getRank();
        if (rank == null || rank == 2) {
            String lowerName = request.getName().toLowerCase();
            if (lowerName.contains("trưởng") || lowerName.contains("giám đốc") || lowerName.contains("head") || lowerName.contains("director")) rank = 0;
            else if (lowerName.contains("phó") || lowerName.contains("deputy")) rank = 1;
            else rank = 2;
        }

        if (rank != 2 && roleRepository.existsByLevelAndRankAndOrganizationIdAndDeletedAtIsNull(request.getLevel(), rank, orgId)) {
            String rankName = (rank == 0) ? "TRƯỞNG (Rank 0)" : "PHÓ (Rank 1)";
            throw new BusinessException("Mỗi phân cấp chỉ được phép có tối đa 1 " + rankName);
        }

        Role role = Role.builder()
                .organization(com.kpitracking.entity.Organization.builder().id(orgId).build())
                .name(request.getName())
                .level(request.getLevel())
                .rank(rank)
                .createdBy(user)
                .build();

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
            if (roleRepository.existsByNameIgnoreCaseAndOrganizationIdAndIdNot(request.getName(), role.getOrganization().getId(), roleId)) {
                throw new DuplicateResourceException("Vai trò", "tên", request.getName());
            }
            role.setName(request.getName());
        }
        
        if (request.getLevel() != null) {
            role.setLevel(request.getLevel());
        }

        if (request.getRank() != null) {
            role.setRank(request.getRank());
        } else if (request.getName() != null) {
            String lowerName = request.getName().toLowerCase();
            if (lowerName.contains("trưởng") || lowerName.contains("giám đốc") || lowerName.contains("head") || lowerName.contains("director")) role.setRank(0);
            else if (lowerName.contains("phó") || lowerName.contains("deputy")) role.setRank(1);
        }

        if (role.getRank() != 2 && roleRepository.existsByLevelAndRankAndOrganizationIdAndIdNotAndDeletedAtIsNull(role.getLevel(), role.getRank(), role.getOrganization().getId(), roleId)) {
            String rankName = (role.getRank() == 0) ? "TRƯỞNG (Rank 0)" : "PHÓ (Rank 1)";
            throw new BusinessException("Mỗi phân cấp chỉ được phép có tối đa 1 " + rankName);
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
        User user = getCurrentUser();
        UUID orgId = userRoleOrgUnitRepository.findByUserId(user.getId())
                .stream()
                .map(uro -> uro.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId())
                .findFirst()
                .orElseThrow(() -> new BusinessException("User does not belong to any organization"));
                
        return roleRepository.findAllByOrganizationIdAndDeletedAtIsNull(orgId).stream()
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
