package com.kpitracking.service;

import com.kpitracking.dto.request.submission.CreateSubmissionRequest;
import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.Company;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.KpiSubmittedEvent;
import com.kpitracking.event.SubmissionReviewedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.CompanyRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
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
public class KpiSubmissionService {

    private final KpiSubmissionRepository submissionRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final com.kpitracking.repository.DepartmentRepository departmentRepository;
    private final com.kpitracking.repository.DepartmentMemberRepository departmentMemberRepository;
    private final SubmissionMapper submissionMapper;
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
    public SubmissionResponse createSubmission(CreateSubmissionRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Company", "id", companyId));

        KpiCriteria kpi = kpiCriteriaRepository.findByIdAndCompanyId(request.getKpiCriteriaId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Criteria", "id", request.getKpiCriteriaId()));

        if (kpi.getStatus() != KpiStatus.APPROVED) {
            throw new BusinessException("Can only submit against APPROVED KPI criteria");
        }

        boolean isAssignee = kpi.getAssignedTo() != null && kpi.getAssignedTo().getId().equals(currentUser.getId());
        boolean isDeptMember = kpi.getAssignedTo() == null && kpi.getDepartment() != null &&
                departmentMemberRepository.existsByDepartmentIdAndUserId(kpi.getDepartment().getId(), currentUser.getId());

        if (!isAssignee && !isDeptMember) {
            throw new com.kpitracking.exception.ForbiddenException("You are not assigned to this KPI criteria");
        }

        KpiSubmission submission = KpiSubmission.builder()
                .company(company)
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
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

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
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();
        KpiSubmission submission = submissionRepository.findByIdAndCompanyId(submissionId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        boolean isSubmitter = submission.getSubmittedBy().getId().equals(currentUser.getId());
        boolean isDirector = currentUser.getRole() == com.kpitracking.enums.UserRole.DIRECTOR;
        
        if (!isSubmitter && !isDirector) {
             // For HEAD, check if they manage this person
             boolean isHeadOfSubmitter = departmentRepository.findByCompanyId(companyId, PageRequest.of(0, 100))
                    .getContent().stream()
                    .filter(dept -> dept.getHead() != null && dept.getHead().getId().equals(currentUser.getId()))
                    .anyMatch(dept -> departmentMemberRepository.existsByDepartmentIdAndUserId(dept.getId(), submission.getSubmittedBy().getId()));
             
             if (!isHeadOfSubmitter) {
                 throw new com.kpitracking.exception.ForbiddenException("You can only view your own or your department's submissions");
             }
        }

        return submissionMapper.toResponse(submission);
    }

    @Transactional
    public SubmissionResponse reviewSubmission(UUID submissionId, ReviewSubmissionRequest request) {
        User currentUser = getCurrentUser();
        UUID companyId = currentUser.getCompany().getId();

        KpiSubmission submission = submissionRepository.findByIdAndCompanyId(submissionId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Can only review PENDING submissions");
        }

        final UUID submitterId = submission.getSubmittedBy().getId();

        if (currentUser.getRole() != com.kpitracking.enums.UserRole.DIRECTOR) {
            boolean isHeadOfSubmitter = departmentRepository.findByCompanyId(companyId, PageRequest.of(0, 100))
                    .getContent().stream()
                    .filter(dept -> dept.getHead() != null && dept.getHead().getId().equals(currentUser.getId()))
                    .anyMatch(dept -> departmentMemberRepository
                            .existsByDepartmentIdAndUserId(dept.getId(), submitterId)); // ✅ dùng biến final

            if (!isHeadOfSubmitter) {
                throw new com.kpitracking.exception.ForbiddenException(
                        "You can only review submissions for your department members");
            }
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
        UUID companyId = currentUser.getCompany().getId();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiSubmission> subPage = submissionRepository.findByCompanyIdAndSubmittedById(
                companyId, currentUser.getId(), pageable);

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
        UUID companyId = getCurrentCompanyId();
        KpiSubmission submission = submissionRepository.findByIdAndCompanyId(submissionId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Can only delete PENDING submissions");
        }

        User currentUser = getCurrentUser();
        if (!submission.getSubmittedBy().getId().equals(currentUser.getId())) {
             throw new com.kpitracking.exception.ForbiddenException("Only the original submitter can delete the submission");
        }

        submission.setDeletedAt(Instant.now());
        submissionRepository.save(submission);
    }
}
