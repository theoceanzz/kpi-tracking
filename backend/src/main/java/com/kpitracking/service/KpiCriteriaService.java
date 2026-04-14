package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.entity.Company;
import com.kpitracking.entity.Department;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.event.KpiCriteriaApprovedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.DepartmentRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRepository;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiCriteriaService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final DepartmentRepository departmentRepository;
    private final com.kpitracking.repository.DepartmentMemberRepository departmentMemberRepository;
    private final KpiCriteriaMapper kpiCriteriaMapper;
    private final ApplicationEventPublisher eventPublisher;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    private UUID getCurrentCompanyId() {
        return getCurrentUser().getCompany().getId();
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        KpiStatus initialStatus = (currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR) ? KpiStatus.APPROVED : KpiStatus.DRAFT;

        KpiCriteria kpi = KpiCriteria.builder()
                .company(company)
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

        if (request.getDepartmentId() != null) {
            Department dept = departmentRepository.findByIdAndCompanyId(request.getDepartmentId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));
            
            
            // Check if current user belongs to the target department
            boolean isMemberOfTarget = departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), currentUser.getId());
            if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR && !isMemberOfTarget) {
                throw new com.kpitracking.exception.ForbiddenException("Trưởng phòng chỉ có thể thêm chỉ tiêu cho phòng ban của mình.");
            }
            kpi.setDepartment(dept);
        } else if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            java.util.List<com.kpitracking.entity.DepartmentMember> userDepts = departmentMemberRepository.findByUserId(currentUser.getId());
            if (!userDepts.isEmpty()) {
                kpi.setDepartment(userDepts.get(0).getDepartment());
            }
        }

        if (request.getAssignedToId() != null) {
            User assignee = userRepository.findByIdAndCompanyId(request.getAssignedToId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User (assignee)", "id", request.getAssignedToId()));

            if (currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR && assignee.getRole() == com.kpitracking.enums.UserRole.DIRECTOR) {
                throw new com.kpitracking.exception.ForbiddenException("Giám đốc không thể giao chỉ tiêu cho Giám đốc khác.");
            }
            if (currentUser.getRole() == com.kpitracking.enums.UserRole.HEAD && 
                (assignee.getRole() == com.kpitracking.enums.UserRole.DIRECTOR || assignee.getRole() == com.kpitracking.enums.UserRole.HEAD)) {
                throw new com.kpitracking.exception.ForbiddenException("Trưởng phòng chỉ có thể giao chỉ tiêu cho Phó phòng hoặc Nhân viên.");
            }

            kpi.setAssignedTo(assignee);
        }

        kpi = kpiCriteriaRepository.save(kpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID departmentId) {
        UUID companyId = getCurrentCompanyId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage;
        if (status != null) {
            kpiPage = kpiCriteriaRepository.findByCompanyIdAndStatus(companyId, status, pageable);
        } else if (departmentId != null) {
            kpiPage = kpiCriteriaRepository.findByCompanyIdAndDepartmentId(companyId, departmentId, pageable);
        } else {
            kpiPage = kpiCriteriaRepository.findByCompanyId(companyId, pageable);
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
        UUID companyId = getCurrentCompanyId();
        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
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
        if (request.getDepartmentId() != null) {
            Department dept = departmentRepository.findByIdAndCompanyId(request.getDepartmentId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Department", "id", request.getDepartmentId()));

            
            // Check if current user belongs to the target department
            boolean isMemberOfTarget = departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), currentUser.getId());
            if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR && !isMemberOfTarget) {
                throw new com.kpitracking.exception.ForbiddenException("Trưởng phòng chỉ có thể thêm chỉ tiêu cho phòng ban của mình.");
            }
            kpi.setDepartment(dept);
        } else if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            java.util.List<com.kpitracking.entity.DepartmentMember> userDepts = departmentMemberRepository.findByUserId(currentUser.getId());
            if (!userDepts.isEmpty()) {
                kpi.setDepartment(userDepts.get(0).getDepartment());
            }
        }

        if (request.getAssignedToId() != null) {
            User assignee = userRepository.findByIdAndCompanyId(request.getAssignedToId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("User", "id", request.getAssignedToId()));

            if (currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR && assignee.getRole() == com.kpitracking.enums.UserRole.DIRECTOR) {
                throw new com.kpitracking.exception.ForbiddenException("Giám đốc không thể giao chỉ tiêu cho Giám đốc khác.");
            }
            if (currentUser.getRole() == com.kpitracking.enums.UserRole.HEAD && 
                (assignee.getRole() == com.kpitracking.enums.UserRole.DIRECTOR || assignee.getRole() == com.kpitracking.enums.UserRole.HEAD)) {
                throw new com.kpitracking.exception.ForbiddenException("Trưởng phòng chỉ có thể giao chỉ tiêu cho Phó phòng hoặc Nhân viên.");
            }

            kpi.setAssignedTo(assignee);
        }

        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
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
        UUID companyId = currentUser.getCompany().getId();

        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR && currentUser.getRole() != com.kpitracking.enums.UserRole.HEAD) {
            throw new com.kpitracking.exception.ForbiddenException("Only DIRECTOR or HEAD can approve KPI criteria");
        }

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
        UUID companyId = currentUser.getCompany().getId();

        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR && currentUser.getRole() != com.kpitracking.enums.UserRole.HEAD) {
            throw new com.kpitracking.exception.ForbiddenException("Only DIRECTOR or HEAD can reject KPI criteria");
        }

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
        UUID companyId = currentUser.getCompany().getId();
        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(kpiId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", kpiId));

        if (!kpi.getCreatedBy().getId().equals(currentUser.getId()) && currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            throw new BusinessException("Only the creator or DIRECTOR can delete this KPI");
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findMyKpis(
                companyId, currentUser.getId(), pageable);

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
