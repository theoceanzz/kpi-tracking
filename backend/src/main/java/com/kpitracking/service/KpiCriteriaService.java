package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.event.KpiCriteriaApprovedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiCriteriaService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiCriteriaMapper kpiCriteriaMapper;
    private final ApplicationEventPublisher eventPublisher;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    private boolean hasAnyRole(UUID userId, String... roleNames) {
        List<String> names = List.of(roleNames);
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> names.stream().anyMatch(n -> n.equalsIgnoreCase(uro.getRole().getName())));
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiStatus initialStatus = isDirector ? KpiStatus.APPROVED : KpiStatus.DRAFT;

        KpiCriteria kpi = KpiCriteria.builder()
                .name(request.getName())
                .description(request.getDescription())
                .weight(request.getWeight())
                .targetValue(request.getTargetValue())
                .unit(request.getUnit())
                .frequency(request.getFrequency())
                .status(initialStatus)
                .createdBy(currentUser)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .build();

        if (initialStatus == KpiStatus.APPROVED) {
            kpi.setApprovedBy(currentUser);
            kpi.setApprovedAt(Instant.now());
        }

        // Set orgUnit
        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));
            kpi.setOrgUnit(orgUnit);
        } else {
            // Use the first org unit the user belongs to
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                kpi.setOrgUnit(assignments.get(0).getOrgUnit());
            } else {
                throw new BusinessException("User must belong to at least one org unit to create KPI");
            }
        }

        if (request.getAssignedToId() != null) {
            User assignee = userRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("User (assignee)", "id", request.getAssignedToId()));
            kpi.setAssignedTo(assignee);
        }

        kpi = kpiCriteriaRepository.save(kpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage;
        if (status != null && orgUnitId != null) {
            kpiPage = kpiCriteriaRepository.findByOrgUnitIdAndStatus(orgUnitId, status, pageable);
        } else if (status != null) {
            kpiPage = kpiCriteriaRepository.findByStatus(status, pageable);
        } else if (orgUnitId != null) {
            kpiPage = kpiCriteriaRepository.findByOrgUnitId(orgUnitId, pageable);
        } else {
            kpiPage = kpiCriteriaRepository.findAll(pageable);
        }

        return PageResponse.<KpiCriteriaResponse>builder()
                .content(kpiPage.getContent().stream().map(kpiCriteriaMapper::toResponse).toList())
                .page(kpiPage.getNumber())
                .size(kpiPage.getSize())
                .totalElements(kpiPage.getTotalElements())
                .totalPages(kpiPage.getTotalPages())
                .last(kpiPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public KpiCriteriaResponse getKpiCriteriaById(UUID kpiId) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !isDirector) {
            throw new BusinessException("Only the creator or DIRECTOR can modify this KPI");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Can only update KPI in DRAFT or REJECTED status");
        }

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());
        if (request.getFrequency() != null) kpi.setFrequency(request.getFrequency());
        if (request.getStartDate() != null) kpi.setStartDate(request.getStartDate());
        if (request.getEndDate() != null) kpi.setEndDate(request.getEndDate());

        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("OrgUnit", "id", request.getOrgUnitId()));
            kpi.setOrgUnit(orgUnit);
        }

        if (request.getAssignedToId() != null) {
            User assignee = userRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getAssignedToId()));
            kpi.setAssignedTo(assignee);
        }

        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId())) {
             throw new BusinessException("Only the creator can submit this KPI");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Can only submit KPI in DRAFT or REJECTED status");
        }

        kpi.setStatus(KpiStatus.PENDING_APPROVAL);
        kpi.setSubmittedAt(Instant.now());
        kpi.setRejectReason(null);
        kpi = kpiCriteriaRepository.save(kpi);

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse approveKpi(UUID kpiId) {
        User currentUser = getCurrentUser();

        if (!hasAnyRole(currentUser.getId(), "DIRECTOR", "HEAD")) {
            throw new ForbiddenException("Only DIRECTOR or HEAD can approve KPI criteria");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Can only approve KPI in PENDING_APPROVAL status");
        }

        kpi.setStatus(KpiStatus.APPROVED);
        kpi.setApprovedBy(currentUser);
        kpi.setApprovedAt(Instant.now());
        kpi = kpiCriteriaRepository.save(kpi);

        eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse rejectKpi(UUID kpiId, RejectKpiRequest request) {
        User currentUser = getCurrentUser();

        if (!hasAnyRole(currentUser.getId(), "DIRECTOR", "HEAD")) {
            throw new ForbiddenException("Only DIRECTOR or HEAD can reject KPI criteria");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Can only reject KPI in PENDING_APPROVAL status");
        }

        kpi.setStatus(KpiStatus.REJECTED);
        kpi.setRejectReason(request.getReason());
        kpi.setApprovedBy(currentUser);
        kpi = kpiCriteriaRepository.save(kpi);

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public void deleteKpiCriteria(UUID kpiId) {
        User currentUser = getCurrentUser();
        boolean isDirector = hasRole(currentUser.getId(), "DIRECTOR");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !isDirector) {
            throw new BusinessException("Only the creator or DIRECTOR can delete this KPI");
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size) {
        User currentUser = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findByAssignedToIdOrCreatedById(
                currentUser.getId(), currentUser.getId(), pageable);

        return PageResponse.<KpiCriteriaResponse>builder()
                .content(kpiPage.getContent().stream().map(kpiCriteriaMapper::toResponse).toList())
                .page(kpiPage.getNumber())
                .size(kpiPage.getSize())
                .totalElements(kpiPage.getTotalElements())
                .totalPages(kpiPage.getTotalPages())
                .last(kpiPage.isLast())
                .build();
    }
}
