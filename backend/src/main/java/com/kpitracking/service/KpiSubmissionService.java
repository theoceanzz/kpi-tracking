package com.kpitracking.service;

import com.kpitracking.dto.request.submission.CreateSubmissionRequest;
import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.KpiSubmittedEvent;
import com.kpitracking.event.SubmissionReviewedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
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
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiSubmissionService {

    private final KpiSubmissionRepository submissionRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final SubmissionMapper submissionMapper;
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

    @Transactional
    public SubmissionResponse createSubmission(CreateSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiCriteria kpi = kpiCriteriaRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", request.getKpiCriteriaId()));

        if (kpi.getStatus() != KpiStatus.APPROVED) {
            throw new BusinessException("Can only submit against APPROVED KPI criteria");
        }

        boolean isAssignee = kpi.getAssignedTo() != null && kpi.getAssignedTo().getId().equals(currentUser.getId());
        if (!isAssignee) {
            // Check if user has any role assignment in the same org unit as the KPI
            boolean isInSameOrgUnit = kpi.getOrgUnit() != null &&
                    userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), kpi.getOrgUnit().getId())
                            .stream().findAny().isPresent();
            if (!isInSameOrgUnit) {
                throw new ForbiddenException("You are not assigned to this KPI criteria");
            }
        }

        KpiSubmission submission = KpiSubmission.builder()
                .orgUnit(kpi.getOrgUnit())
                .kpiCriteria(kpi)
                .submittedBy(currentUser)
                .actualValue(request.getActualValue())
                .note(request.getNote())
                .status(SubmissionStatus.PENDING)
                .periodStart(request.getPeriodStart() != null ? request.getPeriodStart().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .periodEnd(request.getPeriodEnd() != null ? request.getPeriodEnd().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null)
                .build();

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new KpiSubmittedEvent(this, submission));

        return submissionMapper.toResponse(submission);
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getSubmissions(int page, int size, SubmissionStatus status, UUID kpiCriteriaId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

<<<<<<< HEAD
        boolean isDirector = currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR;
        boolean isHead = currentUser.getRole() == com.kpitracking.enums.UserRole.HEAD;
        boolean isDeputy = currentUser.getRole() == com.kpitracking.enums.UserRole.DEPUTY;

        Page<KpiSubmission> subPage;
        if (isDirector) {
            if (status != null) {
                subPage = submissionRepository.findByCompanyIdAndStatus(companyId, status, pageable);
            } else if (kpiCriteriaId != null) {
                subPage = submissionRepository.findByCompanyIdAndKpiCriteriaId(companyId, kpiCriteriaId, pageable);
            } else {
                subPage = submissionRepository.findByCompanyId(companyId, pageable);
            }
        } else if (isHead || isDeputy) {
            java.util.List<com.kpitracking.entity.Department> managedDepts = departmentRepository.findByHeadIdOrDeputyId(currentUser.getId(), currentUser.getId());
            if (managedDepts.isEmpty()) {
                subPage = Page.empty(pageable);
            } else {
                java.util.List<UUID> managedDeptIds = managedDepts.stream().map(com.kpitracking.entity.Department::getId).toList();
                if (status != null) {
                    subPage = submissionRepository.findByCompanyIdAndKpiCriteriaDepartmentIdInAndStatus(companyId, managedDeptIds, status, pageable);
                } else {
                    subPage = submissionRepository.findByCompanyIdAndKpiCriteriaDepartmentIdIn(companyId, managedDeptIds, pageable);
                }
            }
        } else {
            throw new com.kpitracking.exception.ForbiddenException("Only DIRECTOR, HEAD or DEPUTY can view submissions list");
=======
        Page<KpiSubmission> subPage;
        if (status != null) {
            subPage = submissionRepository.findByStatus(status, pageable);
        } else if (kpiCriteriaId != null) {
            subPage = submissionRepository.findByKpiCriteriaId(kpiCriteriaId, pageable);
        } else {
            subPage = submissionRepository.findAll(pageable);
>>>>>>> 7681c6edbb52597770fb6dc8246115573f68d03b
        }

        return PageResponse.<SubmissionResponse>builder()
                .content(subPage.getContent().stream().map(submissionMapper::toResponse).toList())
                .page(subPage.getNumber())
                .size(subPage.getSize())
                .totalElements(subPage.getTotalElements())
                .totalPages(subPage.getTotalPages())
                .last(subPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public SubmissionResponse getSubmissionById(UUID submissionId) {
        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));
        return submissionMapper.toResponse(submission);
    }

    @Transactional
    public SubmissionResponse reviewSubmission(UUID submissionId, ReviewSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Can only review PENDING submissions");
        }

        if (!hasRole(currentUser.getId(), "DIRECTOR") && !hasRole(currentUser.getId(), "HEAD")) {
            throw new ForbiddenException("Only DIRECTOR or HEAD can review submissions");
        }

        submission.setStatus(request.getStatus());
        submission.setReviewedBy(currentUser);
        submission.setReviewNote(request.getReviewNote());
        submission.setReviewedAt(Instant.now());

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new SubmissionReviewedEvent(this, submission));

        return submissionMapper.toResponse(submission);
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getMySubmissions(int page, int size) {
        User currentUser = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiSubmission> subPage = submissionRepository.findBySubmittedById(
                currentUser.getId(), pageable);

        return PageResponse.<SubmissionResponse>builder()
                .content(subPage.getContent().stream().map(submissionMapper::toResponse).toList())
                .page(subPage.getNumber())
                .size(subPage.getSize())
                .totalElements(subPage.getTotalElements())
                .totalPages(subPage.getTotalPages())
                .last(subPage.isLast())
                .build();
    }

    @Transactional
    public void deleteSubmission(UUID submissionId) {
        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Can only delete PENDING submissions");
        }

        User currentUser = getCurrentUser();
        if (!submission.getSubmittedBy().getId().equals(currentUser.getId())) {
             throw new ForbiddenException("Only the original submitter can delete the submission");
        }

        submission.setDeletedAt(Instant.now());
        submissionRepository.save(submission);
    }
}
