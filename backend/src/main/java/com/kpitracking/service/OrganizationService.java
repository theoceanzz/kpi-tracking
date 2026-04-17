package com.kpitracking.service;

import com.kpitracking.dto.request.organization.CreateOrganizationRequest;
import com.kpitracking.dto.request.organization.UpdateOrganizationRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.organization.OrganizationResponse;
import com.kpitracking.entity.Organization;
import com.kpitracking.enums.OrganizationStatus;
import com.kpitracking.exception.DuplicateResourceException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.OrganizationMapper;
import com.kpitracking.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final OrganizationMapper organizationMapper;

    @Transactional
    public OrganizationResponse createOrganization(CreateOrganizationRequest request) {
        if (organizationRepository.existsByCode(request.getCode())) {
            throw new DuplicateResourceException("Organization", "code", request.getCode());
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
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
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
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));

        if (request.getName() != null) {
            organization.setName(request.getName());
        }
        if (request.getStatus() != null) {
            organization.setStatus(OrganizationStatus.valueOf(request.getStatus().toUpperCase()));
        }

        organization = organizationRepository.save(organization);
        return organizationMapper.toResponse(organization);
    }

    @Transactional
    public void deleteOrganization(UUID orgId) {
        Organization organization = organizationRepository.findById(orgId)
                .orElseThrow(() -> new ResourceNotFoundException("Organization", "id", orgId));
        organization.setStatus(OrganizationStatus.ARCHIVED);
        organizationRepository.save(organization);
    }
}
