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
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private boolean hasRole(UUID userId, String roleName) {
        return userRoleOrgUnitRepository.findByUserId(userId).stream()
                .anyMatch(uro -> uro.getRole().getName().equalsIgnoreCase(roleName));
    }

    @Transactional
    public SubmissionResponse createSubmission(CreateSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiCriteria kpi = kpiCriteriaRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", request.getKpiCriteriaId()));

        if (kpi.getStatus() != KpiStatus.APPROVED) {
            throw new BusinessException("Chỉ có thể nộp báo cáo cho những chỉ tiêu KPI đã được PHÊ DUYỆT");
        }

        boolean isAssignee = kpi.getAssignees().stream()
                .anyMatch(u -> u.getId().equals(currentUser.getId()));
        if (!isAssignee) {
            // Check if user has any role assignment in the same org unit as the KPI
            boolean isInSameOrgUnit = kpi.getOrgUnit() != null &&
                    userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), kpi.getOrgUnit().getId())
                            .stream().findAny().isPresent();
            if (!isInSameOrgUnit) {
                throw new ForbiddenException("Bạn không được giao thực hiện chỉ tiêu KPI này");
            }
        }

        // Validation of period dates against KPI range (comparing at LocalDate level to avoid precision issues)
        java.time.LocalDate kpiStart = kpi.getStartDate() != null ? kpi.getStartDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;
        java.time.LocalDate kpiEnd = kpi.getEndDate() != null ? kpi.getEndDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;

        if (request.getPeriodStart() != null && kpiStart != null && request.getPeriodStart().isBefore(kpiStart)) {
            throw new BusinessException("Ngày bắt đầu báo cáo không được trước ngày bắt đầu của KPI (" + kpiStart + ")");
        }
        if (request.getPeriodEnd() != null && kpiEnd != null && request.getPeriodEnd().isAfter(kpiEnd)) {
            throw new BusinessException("Ngày kết thúc báo cáo không được sau ngày kết thúc của KPI (" + kpiEnd + ")");
        }
        if (request.getPeriodStart() != null && request.getPeriodEnd() != null && request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException("Ngày kết thúc không được trước ngày bắt đầu");
        }

        Instant pStart = request.getPeriodStart() != null ? request.getPeriodStart().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null;
        Instant pEnd = request.getPeriodEnd() != null ? request.getPeriodEnd().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null;

        KpiSubmission submission = KpiSubmission.builder()
                .orgUnit(kpi.getOrgUnit())
                .kpiCriteria(kpi)
                .submittedBy(currentUser)
                .actualValue(request.getActualValue())
                .note(request.getNote())
                .status(SubmissionStatus.PENDING)
                .periodStart(pStart)
                .periodEnd(pEnd)
                .build();

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new KpiSubmittedEvent(this, submission));

        return submissionMapper.toResponse(submission);
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getSubmissions(int page, int size, SubmissionStatus status, UUID kpiCriteriaId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<KpiSubmission> subPage;
        if (status != null) {
            subPage = submissionRepository.findByStatus(status, pageable);
        } else if (kpiCriteriaId != null) {
            subPage = submissionRepository.findByKpiCriteriaId(kpiCriteriaId, pageable);
        } else {
            subPage = submissionRepository.findAll(pageable);
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
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));
        return submissionMapper.toResponse(submission);
    }

    @Transactional
    public SubmissionResponse reviewSubmission(UUID submissionId, ReviewSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Chỉ có thể phê duyệt các bản nộp đang ở trạng thái CHỜ DUYỆT");
        }

        if (!hasRole(currentUser.getId(), "DIRECTOR") && !hasRole(currentUser.getId(), "HEAD")) {
            throw new ForbiddenException("Chỉ GIÁM ĐỐC hoặc TRƯỞNG PHÒNG mới có quyền phê duyệt bản nộp");
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
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Chỉ có thể xóa các bản nộp đang ở trạng thái CHỜ DUYỆT");
        }

        User currentUser = getCurrentUser();
        if (!submission.getSubmittedBy().getId().equals(currentUser.getId())) {
             throw new ForbiddenException("Chỉ người nộp mới có quyền xóa bản nộp này");
        }

        submission.setDeletedAt(Instant.now());
        submissionRepository.save(submission);
    }
}
