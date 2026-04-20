package com.kpitracking.service;

import com.kpitracking.dto.request.auth.HierarchyLevelDTO;
import com.kpitracking.dto.request.organization.CreateOrganizationRequest;
import com.kpitracking.dto.request.organization.UpdateOrganizationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.OrgHierarchyLevel;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.OrganizationStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrganizationMapper;
import com.kpitracking.repository.OrgHierarchyLevelRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.OrganizationRepository;
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
    private final OrgHierarchyLevelRepository orgHierarchyLevelRepository;
    private final OrgUnitRepository orgUnitRepository;

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

        organization = organizationRepository.save(organization);
        return organizationMapper.toResponse(organization);
    }

    private void syncHierarchyLevels(Organization organization, List<HierarchyLevelDTO> newLevels) {
        if (newLevels.size() < 3) {
            throw new BusinessException("Cơ cấu tổ chức phải có ít nhất 3 cấp.");
        }

        List<OrgHierarchyLevel> currentLevels = orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(organization.getId());
        
        // 1. Check for removals and if they are in use
        for (int i = newLevels.size(); i < currentLevels.size(); i++) {
            OrgHierarchyLevel levelToRemove = currentLevels.get(i);
            if (orgUnitRepository.existsByOrgHierarchyLevelId(levelToRemove.getId())) {
                throw new BusinessException("Không thể xóa cấp bậc '" + levelToRemove.getUnitTypeName() + "' vì đang có đơn vị sử dụng.");
            }
            orgHierarchyLevelRepository.delete(levelToRemove);
        }

        // 2. Update or Add
        for (int i = 0; i < newLevels.size(); i++) {
            HierarchyLevelDTO dto = newLevels.get(i);
            if (i < currentLevels.size()) {
                // Update existing
                OrgHierarchyLevel level = currentLevels.get(i);
                level.setUnitTypeName(dto.getUnitTypeName());
                level.setManagerRoleLabel(dto.getManagerRoleLabel());
                orgHierarchyLevelRepository.save(level);
            } else {
                // Add new
                OrgHierarchyLevel level = OrgHierarchyLevel.builder()
                        .organization(organization)
                        .levelOrder(i)
                        .unitTypeName(dto.getUnitTypeName())
                        .managerRoleLabel(dto.getManagerRoleLabel())
                        .build();
                orgHierarchyLevelRepository.save(level);
            }
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
    public List<com.kpitracking.dto.response.organization.OrgHierarchyLevelResponse> getHierarchyLevels(UUID orgId) {
        organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Tổ chức", "id", orgId));

        return orgHierarchyLevelRepository.findByOrganizationIdOrderByLevelOrderAsc(orgId)
                .stream()
                .map(level -> com.kpitracking.dto.response.organization.OrgHierarchyLevelResponse.builder()
                        .id(level.getId())
                        .levelOrder(level.getLevelOrder())
                        .unitTypeName(level.getUnitTypeName())
                        .managerRoleLabel(level.getManagerRoleLabel())
                        .build())
                .collect(Collectors.toList());
    }
}
