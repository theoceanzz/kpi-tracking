package com.kpitracking.service;

import com.kpitracking.constant.RolePermissionConstants;
import com.kpitracking.dto.request.auth.HierarchyLevelDTO;
import com.kpitracking.dto.request.organization.CreateOrganizationRequest;
import com.kpitracking.dto.request.organization.UpdateOrganizationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.organization.HierarchyLevelResponse;
import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.OrganizationStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrgHierarchyLevelMapper;
import com.kpitracking.mapper.OrganizationMapper;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMapper organizationMapper;
    private final OrgHierarchyLevelMapper orgHierarchyLevelMapper;
    private final OrgHierarchyLevelRepository orgHierarchyLevelRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final com.kpitracking.repository.RoleRepository roleRepository;
    private final com.kpitracking.repository.PermissionRepository permissionRepository;
    private final com.kpitracking.repository.RolePermissionRepository rolePermissionRepository;

    @Transactional
    public OrganizationResponse createOrganization(CreateOrganizationRequest request) {
        if (organizationRepository.existsByCode(request.getCode())) {
            throw new DuplicateResourceException("Tổ chức", "code", request.getCode());
        }

        Organization organization = Organization.builder()
                .name(request.getName())
                .code(request.getCode())
                .status(OrganizationStatus.ACTIVE)
                .build();

        organization = organizationRepository.save(organization);
        return organizationMapper.toResponse(organization);
    }

    @Transactional(readOnly = true)
    public OrganizationResponse getOrganization(UUID orgId) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        return organizationMapper.toResponse(organization);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrganizationResponse> listOrganizations(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Organization> orgPage = organizationRepository.findAll(pageable);

        return PageResponse.<OrganizationResponse>builder()
                .content(orgPage.getContent().stream().map(organizationMapper::toResponse).toList())
                .page(orgPage.getNumber())
                .size(orgPage.getSize())
                .totalElements(orgPage.getTotalElements())
                .totalPages(orgPage.getTotalPages())
                .last(orgPage.isLast())
                .build();
    }

    @Transactional
    public OrganizationResponse updateOrganization(UUID orgId, UpdateOrganizationRequest request) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        if (request.getName() != null) {
            organization.setName(request.getName());
        }
        if (request.getCode() != null && !request.getCode().equals(organization.getCode())) {
            if (organizationRepository.existsByCode(request.getCode())) {
                throw new DuplicateResourceException("Tổ chức", "code", request.getCode());
            }
            organization.setCode(request.getCode());
        }
        if (request.getStatus() != null) {
            organization.setStatus(OrganizationStatus.valueOf(request.getStatus().toUpperCase()));
        }

        if (request.getHierarchyLevels() != null) {
            syncHierarchyLevels(organization, request.getHierarchyLevels());
        }

        if (request.getEvaluationMaxScore() != null) {
            organization.setEvaluationMaxScore(request.getEvaluationMaxScore());
        }
        if (request.getExcellentThreshold() != null) {
            organization.setExcellentThreshold(request.getExcellentThreshold());
        }
        if (request.getGoodThreshold() != null) {
            organization.setGoodThreshold(request.getGoodThreshold());
        }
        if (request.getFairThreshold() != null) {
            organization.setFairThreshold(request.getFairThreshold());
        }
        if (request.getAverageThreshold() != null) {
            organization.setAverageThreshold(request.getAverageThreshold());
        }
        if (request.getKpiReminderPercentage() != null) {
            organization.setKpiReminderPercentage(request.getKpiReminderPercentage());
        }

        organization = organizationRepository.save(organization);
        return organizationMapper.toResponse(organization);
    }

    private void syncHierarchyLevels(Organization organization, List<HierarchyLevelDTO> newLevels) {
        if (newLevels.size() < 2) {
            throw new BusinessException("Cơ cấu tổ chức phải có ít nhất 2 cấp.");
        }

        List<OrgHierarchyLevel> currentLevels = orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(organization.getId());
        List<Permission> allPerms = permissionRepository.findAll();
        
        // 1. Check for removals and if they are in use
        for (int i = newLevels.size(); i < currentLevels.size(); i++) {
            OrgHierarchyLevel levelToRemove = currentLevels.get(i);
            if (orgUnitRepository.existsByOrgHierarchyLevelId(levelToRemove.getId())) {
                throw new BusinessException("Không thể xóa cấp bậc '" + levelToRemove.getUnitTypeName() + "' vì đang có đơn vị sử dụng.");
            }
            
            // Delete roles associated with this level
            List<Role> rolesToRemove = roleRepository.findAllByDeletedAtIsNull().stream()
                    .filter(r -> r.getOrganization() != null && r.getOrganization().getId().equals(organization.getId()))
                    .filter(r -> r.getLevel() != null && r.getLevel().equals(levelToRemove.getRoleLevel()))
                    .toList();
            
            for (Role r : rolesToRemove) {
                r.setDeletedAt(java.time.Instant.now());
                roleRepository.save(r);
            }

            orgHierarchyLevelRepository.delete(levelToRemove);
        }

        // 2. Update or Add
        int totalLevels = newLevels.size();
        for (int i = 0; i < totalLevels; i++) {
            HierarchyLevelDTO dto = newLevels.get(i);
            int roleLevel = mapRoleLevel(i, totalLevels);
            boolean isTop = (i == 0);
            boolean isBottom = (i == totalLevels - 1);
            
            if (i < currentLevels.size()) {
                // Update existing level
                OrgHierarchyLevel level = currentLevels.get(i);
                level.setUnitTypeName(dto.getUnitTypeName());
                level.setManagerRoleLabel(dto.getManagerRoleLabel());
                level.setRoleLevel(roleLevel);
                orgHierarchyLevelRepository.save(level);
                
                // Sync Roles for this level
                syncRolesForLevel(organization, roleLevel, dto, isTop, isBottom, allPerms, i + 1, totalLevels);
            } else {
                // Add new level
                OrgHierarchyLevel level = OrgHierarchyLevel.builder()
                        .organization(organization)
                        .levelOrder(i)
                        .unitTypeName(dto.getUnitTypeName())
                        .managerRoleLabel(dto.getManagerRoleLabel())
                        .roleLevel(roleLevel)
                        .build();
                orgHierarchyLevelRepository.save(level);
                
                // Create Roles for this new level
                syncRolesForLevel(organization, roleLevel, dto, isTop, isBottom, allPerms, i + 1, totalLevels);
            }
        }
    }

    private void syncRolesForLevel(Organization org, int roleLevel, HierarchyLevelDTO dto, boolean isTop, boolean isBottom, List<Permission> allPerms, int tierLevel, int numTiers) {
        // Head (Rank 0)
        String headName;
        if (dto.getManagerRoleLabel() != null && !dto.getManagerRoleLabel().trim().isEmpty()) {
            headName = dto.getManagerRoleLabel();
        } else {
            headName = isTop ? "GIÁM ĐỐC" : "TRƯỞNG " + dto.getUnitTypeName().toUpperCase();
        }
        syncSingleRole(org, headName, roleLevel, 0, isTop ? "director" : "manager", allPerms, tierLevel, numTiers);

        // Deputy (Rank 1)
        String deputyName;
        if (dto.getManagerRoleLabel() != null && !dto.getManagerRoleLabel().trim().isEmpty()) {
            String managerLabel = dto.getManagerRoleLabel().trim();
            if (!isTop) {
                String baseLabel = managerLabel.replaceFirst("(?i)^Trưởng\\s*", "").trim();
                deputyName = baseLabel.isEmpty() ? "Phó" : "Phó " + baseLabel;
            } else {
                deputyName = "Phó " + managerLabel;
            }
        } else {
            deputyName = "Phó " + (isTop ? "Giám Đốc" : dto.getUnitTypeName().toUpperCase());
        }
        syncSingleRole(org, deputyName, roleLevel, 1, isTop ? "deputy_director" : "deputy", allPerms, tierLevel, numTiers);

        // Staff (Rank 2) - only for bottom level
        if (isBottom) {
            syncSingleRole(org, "NHÂN VIÊN", roleLevel, 2, "staff", allPerms, tierLevel, numTiers);
        }
    }

    private void syncSingleRole(Organization org, String name, int level, int rank, String archetype, List<Permission> allPerms, int tierLevel, int numTiers) {
        Role role = roleRepository.findByLevelAndRankAndOrganizationId(level, rank, org.getId())
                .orElse(null);
        
        if (role == null) {
            role = Role.builder()
                    .organization(org)
                    .name(name)
                    .level(level)
                    .rank(rank)
                    .isSystem(level == 0 && rank == 0)
                    .build();
            role = roleRepository.save(role);
        } else {
            role.setName(name);
            role.setLevel(level);
            roleRepository.save(role);
        }

        // Re-sync permissions
        updateRolePermissions(role, archetype, allPerms, tierLevel, numTiers);
    }

    private void updateRolePermissions(Role role, String archetype, List<Permission> allPerms, int tierLevel, int numTiers) {
        List<String> allowedCodes = RolePermissionConstants.getPermissions(archetype, tierLevel, numTiers);
        
        // Remove existing ones
        rolePermissionRepository.deleteByRoleId(role.getId());
        rolePermissionRepository.flush();

        for (String code : allowedCodes) {
            Permission p = allPerms.stream()
                    .filter(perm -> perm.getCode().equals(code))
                    .findFirst()
                    .orElseGet(() -> permissionRepository.findByCode(code).orElse(null));

            if (p == null && "ORG:VIEW_TREE".equals(code)) {
                p = permissionRepository.save(Permission.builder()
                        .code("ORG:VIEW_TREE")
                        .resource("ORG")
                        .action("VIEW_TREE")
                        .description("Xem sơ đồ tổ chức (không có quyền quản trị)")
                        .build());
            }

            if (p != null) {
                rolePermissionRepository.save(RolePermission.builder().role(role).permission(p).build());
            }
        }
    }

    private int mapRoleLevel(int order, int total) {
        switch (total) {
            case 2:
                return order == 0 ? 2 : 4;
            case 3:
                return order + 2; // 0->2, 1->3, 2->4
            case 4:
                return order + 1; // 0->1, 1->2, 2->3, 3->4
            case 5:
                return order;     // 0->0, 1->1, 2->2, 3->3, 4->4
            default:
                // Fallback for unexpected cases
                return Math.min(4, order + (5 - total));
        }
    }

    @Transactional
    public void deleteOrganization(UUID orgId) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));
        organization.setStatus(OrganizationStatus.ARCHIVED);
        organizationRepository.save(organization);
    }

    @Transactional(readOnly = true)
    public List<HierarchyLevelResponse> getHierarchyLevels(UUID orgId) {
        organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        return orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(orgId)
                .stream()
                .map(orgHierarchyLevelMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public long countMembers(UUID orgId) {
        if (!organizationRepository.existsById(orgId)) {
            throw new ResourceNotFoundException("Tổ chức", "id", orgId);
        }
        return userRoleOrgUnitRepository.countUsersByOrganizationId(orgId);
    }

    @Transactional(readOnly = true)
    public String findOrgUnitIdByName(String name) {
        List<com.kpitracking.entity.OrgUnit> units = orgUnitRepository.findByNameContainingIgnoreCaseAndDeletedAtIsNull(name);
        if (units.isEmpty()) {
            return null;
        }
        // Return the first match's ID as a string
        return units.get(0).getId().toString();
    }

    @Transactional(readOnly = true)
    public String listAllOrgUnitNamesAndIds() {
        List<com.kpitracking.entity.OrgUnit> units = orgUnitRepository.findAll()
                .stream()
                .filter(u -> u.getDeletedAt() == null)
                .toList();
        if (units.isEmpty()) {
            return "Hiện tại không có đơn vị tổ chức nào trong hệ thống.";
        }
        StringBuilder sb = new StringBuilder("Danh sách đơn vị tổ chức:\n");
        for (com.kpitracking.entity.OrgUnit unit : units) {
            sb.append("- ").append(unit.getName())
              .append(" (ID: ").append(unit.getId()).append(")")
              .append(" [Trạng thái: ").append(unit.getStatus()).append("]")
              .append("\n");
        }
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public String getOrgUnitDetailInfo(UUID orgUnitId) {
        com.kpitracking.entity.OrgUnit unit = orgUnitRepository.findById(orgUnitId)
                .orElse(null);
        if (unit == null || unit.getDeletedAt() != null) {
            return "Không tìm thấy đơn vị tổ chức với ID: " + orgUnitId;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("Thông tin đơn vị: ").append(unit.getName()).append("\n");
        sb.append("- ID: ").append(unit.getId()).append("\n");
        sb.append("- Email: ").append(unit.getEmail() != null ? unit.getEmail() : "Chưa cập nhật").append("\n");
        sb.append("- Số điện thoại: ").append(unit.getPhone() != null ? unit.getPhone() : "Chưa cập nhật").append("\n");
        sb.append("- Địa chỉ: ").append(unit.getAddress() != null ? unit.getAddress() : "Chưa cập nhật").append("\n");
        sb.append("- Trạng thái: ").append(unit.getStatus()).append("\n");
        if (unit.getParent() != null) {
            sb.append("- Thuộc đơn vị cha: ").append(unit.getParent().getName()).append("\n");
        }
        return sb.toString();
    }
}
