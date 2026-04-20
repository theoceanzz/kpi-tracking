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
import com.kpitracking.security.PermissionChecker;
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
    private final PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean canApprove = permissionChecker.hasPermission(currentUser.getId(), "KPI:APPROVE");

        KpiStatus initialStatus = canApprove ? KpiStatus.APPROVED : KpiStatus.DRAFT;

        // Determine OrgUnit
        OrgUnit orgUnit = null;
        if (request.getOrgUnitId() != null) {
            orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
        } else {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                orgUnit = assignments.get(0).getOrgUnit();
            } else {
                throw new BusinessException("Người dùng phải thuộc ít nhất một đơn vị để tạo KPI");
            }
        }

        // Permission check: only users with KPI:CREATE can create
        // The org unit scope check is handled by whether the user belongs to the org unit
        if (!canApprove) {
            boolean belongsToOrgUnit = userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), orgUnit.getId())
                   .stream().findAny().isPresent();
            if (!belongsToOrgUnit) {
                 throw new ForbiddenException("Bạn chỉ có thể thêm chỉ tiêu cho đơn vị của mình.");
            }
        }

        // Determine assignees
        java.util.List<User> assignees = new java.util.ArrayList<>();
        java.util.List<UUID> assigneeIds = new java.util.ArrayList<>();
        if (request.getAssignedToIds() != null && !request.getAssignedToIds().isEmpty()) {
            assigneeIds.addAll(request.getAssignedToIds());
        } else if (request.getAssignedToId() != null) {
            assigneeIds.add(request.getAssignedToId());
        }

        for (UUID assigneeId : assigneeIds) {
            User assignee = userRepository.findById(assigneeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Người dùng (người được giao)", "id", assigneeId));
            assignees.add(assignee);
        }

        KpiCriteria kpi = buildKpiEntity(request, orgUnit, assignees, currentUser, initialStatus);
        kpi = kpiCriteriaRepository.save(kpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    private KpiCriteria buildKpiEntity(CreateKpiCriteriaRequest request, OrgUnit orgUnit, java.util.List<User> assignees, User creator, KpiStatus status) {
        KpiCriteria kpi = KpiCriteria.builder()
                .orgUnit(orgUnit)
                .assignees(assignees)
                .name(request.getName())
                .description(request.getDescription())
                .weight(request.getWeight())
                .targetValue(request.getTargetValue())
                .unit(request.getUnit())
                .frequency(request.getFrequency())
                .status(status)
                .createdBy(creator)
                .startDate(request.getStartDate() != null ? request.getStartDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .endDate(request.getEndDate() != null ? request.getEndDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .build();

        if (status == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }
        return kpi;
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId, UUID createdById) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage;
        if (createdById != null) {
            if (status != null && orgUnitId != null) {
                kpiPage = kpiCriteriaRepository.findByCreatedByIdAndOrgUnitIdAndStatus(createdById, orgUnitId, status, pageable);
            } else if (status != null) {
                kpiPage = kpiCriteriaRepository.findByCreatedByIdAndStatus(createdById, status, pageable);
            } else if (orgUnitId != null) {
                kpiPage = kpiCriteriaRepository.findByCreatedByIdAndOrgUnitId(createdById, orgUnitId, pageable);
            } else {
                kpiPage = kpiCriteriaRepository.findByCreatedById(createdById, pageable);
            }
        } else if (status != null && orgUnitId != null) {
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
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean canApprove = permissionChecker.hasPermission(currentUser.getId(), "KPI:APPROVE");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !canApprove) {
            throw new BusinessException("Chỉ người tạo hoặc người có quyền duyệt KPI mới có thể chỉnh sửa");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể cập nhật KPI ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
        }

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());
        if (request.getFrequency() != null) kpi.setFrequency(request.getFrequency());
        if (request.getStartDate() != null) kpi.setStartDate(request.getStartDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
        if (request.getEndDate() != null) kpi.setEndDate(request.getEndDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant());

        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            kpi.setOrgUnit(orgUnit);
        }

        if (request.getAssignedToIds() != null || request.getAssignedToId() != null) {
            java.util.List<UUID> assigneeIds = new java.util.ArrayList<>();
            if (request.getAssignedToIds() != null) {
                assigneeIds.addAll(request.getAssignedToIds());
            } else if (request.getAssignedToId() != null) {
                assigneeIds.add(request.getAssignedToId());
            }

            java.util.List<User> assignees = new java.util.ArrayList<>();
            for (UUID id : assigneeIds) {
                assignees.add(userRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", id)));
            }
            kpi.setAssignees(assignees);
        }

        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId())) {
             throw new BusinessException("Chỉ người tạo mới có quyền gửi duyệt KPI này");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể gửi duyệt KPI ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
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

        if (!permissionChecker.hasPermission(currentUser.getId(), "KPI:APPROVE")) {
            throw new ForbiddenException("Bạn không có quyền phê duyệt chỉ tiêu KPI");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Chỉ có thể phê duyệt KPI ở trạng thái CHỜ PHÊ DUYỆT");
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

        if (!permissionChecker.hasPermission(currentUser.getId(), "KPI:APPROVE")) {
            throw new ForbiddenException("Bạn không có quyền từ chối chỉ tiêu KPI");
        }

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException("Chỉ có thể từ chối KPI ở trạng thái CHỜ PHÊ DUYỆT");
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
        boolean canDelete = permissionChecker.hasPermission(currentUser.getId(), "KPI:DELETE");

        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && !canDelete) {
            throw new BusinessException("Chỉ người tạo hoặc người có quyền xoá KPI mới có thể xoá");
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size) {
        User currentUser = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findByUserIdInAssignees(
                currentUser.getId(), pageable);

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
