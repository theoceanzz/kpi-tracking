package com.kpitracking.service;

import com.kpitracking.dto.request.submission.BulkReviewRequest;
import com.kpitracking.dto.request.submission.CreateSubmissionRequest;
import com.kpitracking.dto.request.submission.UpdateSubmissionRequest;
import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.submission.SubmissionResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.event.KpiSubmittedEvent;
import com.kpitracking.event.SubmissionReviewedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.mapper.SubmissionMapper;
import com.kpitracking.repository.*;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiSubmissionService {

    private final KpiSubmissionRepository submissionRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final SubmissionMapper submissionMapper;
    private final ApplicationEventPublisher eventPublisher;
    private final PermissionChecker permissionChecker;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }


    @Transactional
    public SubmissionResponse createSubmission(CreateSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiCriteria kpi = kpiCriteriaRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", request.getKpiCriteriaId()));

        if (kpi.getStatus() != KpiStatus.APPROVED && kpi.getStatus() != KpiStatus.EDITED) {
            throw new BusinessException("Chỉ có thể nộp báo cáo cho những chỉ tiêu KPI đã được PHÊ DUYỆT hoặc ĐÃ ĐIỀU CHỈNH");
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

        // --- NEW: Period Open Check ---
        Instant now = Instant.now();
        if (kpi.getKpiPeriod().getStartDate() != null && now.isBefore(kpi.getKpiPeriod().getStartDate())) {
            throw new BusinessException("Kỳ đánh giá chưa bắt đầu. Bạn chỉ có thể nộp từ ngày " + kpi.getKpiPeriod().getStartDate());
        }
        if (kpi.getKpiPeriod().getEndDate() != null && now.isAfter(kpi.getKpiPeriod().getEndDate())) {
            throw new BusinessException("Kỳ đánh giá đã kết thúc. Bạn không thể nộp báo cáo cho kỳ này nữa.");
        }


        // Validation of period dates against KPI range (comparing at LocalDate level to avoid precision issues)
        java.time.LocalDate periodStart = kpi.getKpiPeriod().getStartDate() != null ? kpi.getKpiPeriod().getStartDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;
        java.time.LocalDate periodEnd = kpi.getKpiPeriod().getEndDate() != null ? kpi.getKpiPeriod().getEndDate().atZone(java.time.ZoneOffset.UTC).toLocalDate() : null;

        if (request.getPeriodStart() != null && periodStart != null && request.getPeriodStart().isBefore(periodStart)) {
            throw new BusinessException("Ngày bắt đầu báo cáo không được trước ngày bắt đầu của kỳ đánh giá (" + periodStart + ")");
        }
        if (request.getPeriodEnd() != null && periodEnd != null && request.getPeriodEnd().isAfter(periodEnd)) {
            throw new BusinessException("Ngày kết thúc báo cáo không được sau ngày kết thúc của kỳ đánh giá (" + periodEnd + ")");
        }
        if (request.getPeriodStart() != null && request.getPeriodEnd() != null && request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new BusinessException("Ngày kết thúc không được trước ngày bắt đầu");
        }

        Instant pStart = request.getPeriodStart() != null ? request.getPeriodStart().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null;
        Instant pEnd = request.getPeriodEnd() != null ? request.getPeriodEnd().atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : null;

        // --- NEW: Frequency Rules & Submission Limit ---
        long currentCount = kpi.getSubmissions().stream()
                .filter(s -> s.getDeletedAt() == null &&
                        s.getSubmittedBy().getId().equals(currentUser.getId()) &&
                        (s.getStatus() == SubmissionStatus.PENDING || 
                         s.getStatus() == SubmissionStatus.APPROVED ||
                         s.getStatus() == SubmissionStatus.REJECTED))
                .count();

        int expected = 1;
        if (kpi.getFrequency() != null && kpi.getKpiPeriod() != null) {
            // Re-using the logic from mapper to calculate expected count
            expected = calculateExpected(kpi.getFrequency(), kpi.getKpiPeriod().getPeriodType());
        }

        if (currentCount >= expected) {
            throw new BusinessException("Bạn đã nộp đủ số lượng báo cáo cho chỉ tiêu này (" + currentCount + "/" + expected + ").");
        }

        if (kpi.getFrequency() == KpiFrequency.MONTHLY) {
            java.util.List<KpiSubmission> existing = submissionRepository.findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), currentUser.getId())
                    .stream()
                    .filter(s -> s.getStatus() != SubmissionStatus.REJECTED)
                    .toList();
            
            // Rule 1: Monthly KPI in Monthly Period -> Max 1 submission
            if (kpi.getKpiPeriod().getPeriodType() == KpiFrequency.MONTHLY && !existing.isEmpty()) {
                throw new BusinessException("Bạn đã nộp báo cáo cho chỉ tiêu này trong tháng này.");
            }
            
            // Rule 2: Monthly KPI in Quarterly Period -> Max 3 submissions (once per month)
            if (kpi.getKpiPeriod().getPeriodType() == KpiFrequency.QUARTERLY) {
                if (existing.size() >= 3) {
                    throw new BusinessException("Chỉ tiêu tháng này đã nộp đủ 3 lần báo cáo cho kỳ Quý.");
                }
                
                // Check for overlapping periods
                if (pStart != null && pEnd != null) {
                    for (KpiSubmission s : existing) {
                        if (pStart.isBefore(s.getPeriodEnd()) && pEnd.isAfter(s.getPeriodStart())) {
                            throw new BusinessException("Thời gian báo cáo bị trùng lặp với bản nộp trước đó (" + s.getPeriodStart() + " - " + s.getPeriodEnd() + ")");
                        }
                    }
                }
            }
        }

        Double autoScore = 0.0;
        SubmissionStatus finalStatus = Boolean.TRUE.equals(request.getIsDraft()) ? SubmissionStatus.DRAFT : SubmissionStatus.PENDING;
        String autoReviewNote = null;
        User reviewer = null;
        Instant reviewedAt = null;

        if (request.getActualValue() != null && kpi.getTargetValue() != null && kpi.getWeight() != null && kpi.getTargetValue() != 0) {
            Double minVal = kpi.getMinimumValue() != null ? kpi.getMinimumValue() : 0.0;
            
            // --- NEW: Auto-rejection Rule ---
            if (request.getActualValue() < minVal) {
                finalStatus = SubmissionStatus.REJECTED;
                autoReviewNote = "Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + request.getActualValue() + 
                                 ") thấp hơn mức tối thiểu yêu cầu (" + minVal + ").";
                reviewedAt = Instant.now();
            } else {
                com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
                double multiplier = org.getEvaluationMaxScore() / 100.0;
                autoScore = (request.getActualValue() / kpi.getTargetValue()) * kpi.getWeight() * multiplier;
            }
        }
        
        // If it's a draft, don't trigger auto-rejection yet
        if (Boolean.TRUE.equals(request.getIsDraft())) {
            finalStatus = SubmissionStatus.DRAFT;
            autoReviewNote = null;
            reviewedAt = null;
        }

        KpiSubmission submission = KpiSubmission.builder()
                .orgUnit(kpi.getOrgUnit())
                .kpiCriteria(kpi)
                .submittedBy(currentUser)
                .actualValue(request.getActualValue())
                .note(request.getNote())
                .status(finalStatus)
                .reviewNote(autoReviewNote)
                .reviewedAt(reviewedAt)
                .periodStart(pStart)
                .periodEnd(pEnd)
                .autoScore(autoScore)
                .build();

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new KpiSubmittedEvent(this, submission));

        return submissionMapper.toResponse(submission);
    }

    private SubmissionResponse mapToResponse(KpiSubmission submission) {
        SubmissionResponse res = submissionMapper.toResponse(submission);
        // PBAC: Check if submitter has review permission to label them as a manager in UI
        boolean isManager = permissionChecker.hasPermission(submission.getSubmittedBy().getId(), "SUBMISSION:REVIEW");
        res.setSubmittedByManager(isManager);
        return res;
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getSubmissions(int page, int size, SubmissionStatus status, UUID kpiPeriodId, UUID kpiCriteriaId, UUID submittedById, UUID orgUnitId, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "SUBMISSION:REVIEW");

        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        Integer currentUserRank = currentAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        Page<KpiSubmission> subPage = submissionRepository.findAllWithFilters(
                currentUser.getId(),
                allowedOrgUnitIds,
                status,
                kpiPeriodId,
                kpiCriteriaId,
                submittedById,
                orgUnitPath,
                currentUserRank,
                pageable
        );

        return PageResponse.<SubmissionResponse>builder()
                .content(subPage.getContent().stream().map(this::mapToResponse).toList())
                .page(subPage.getNumber())
                .size(subPage.getSize())
                .totalElements(subPage.getTotalElements())
                .totalPages(subPage.getTotalPages())
                .last(subPage.isLast())
                .build();
    }

    @Transactional
    public SubmissionResponse updateSubmission(UUID submissionId, UpdateSubmissionRequest request) {
        User currentUser = getCurrentUser();
        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        if (!submission.getSubmittedBy().getId().equals(currentUser.getId())) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa bản nộp này");
        }

        if (submission.getStatus() != SubmissionStatus.DRAFT && submission.getStatus() != SubmissionStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể chỉnh sửa các bản nộp ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
        }

        if (request.getActualValue() != null) submission.setActualValue(request.getActualValue());
        if (request.getNote() != null) submission.setNote(request.getNote());
        
        if (request.getPeriodStart() != null) {
            submission.setPeriodStart(request.getPeriodStart().atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
        }
        if (request.getPeriodEnd() != null) {
            submission.setPeriodEnd(request.getPeriodEnd().atStartOfDay(java.time.ZoneOffset.UTC).toInstant());
        }

        // Handle transitioning from DRAFT to PENDING
        if (Boolean.FALSE.equals(request.getIsDraft()) && submission.getStatus() == SubmissionStatus.DRAFT) {
            submission.setStatus(SubmissionStatus.PENDING);
            
            // Re-calculate auto score/rejection
            KpiCriteria kpi = submission.getKpiCriteria();
            if (submission.getActualValue() != null && kpi.getTargetValue() != null && kpi.getWeight() != null && kpi.getTargetValue() != 0) {
                Double minVal = kpi.getMinimumValue() != null ? kpi.getMinimumValue() : 0.0;
                if (submission.getActualValue() < minVal) {
                    submission.setStatus(SubmissionStatus.REJECTED);
                    submission.setReviewNote("Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + submission.getActualValue() + 
                                     ") thấp hơn mức tối thiểu yêu cầu (" + minVal + ").");
                    submission.setReviewedAt(Instant.now());
                } else {
                    com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
                    double multiplier = org.getEvaluationMaxScore() / 100.0;
                    submission.setAutoScore((submission.getActualValue() / kpi.getTargetValue()) * kpi.getWeight() * multiplier);
                }
            }
        } else if (Boolean.TRUE.equals(request.getIsDraft())) {
            submission.setStatus(SubmissionStatus.DRAFT);
        }

        submission = submissionRepository.save(submission);
        return mapToResponse(submission);
    }

    @Transactional(readOnly = true)
    public SubmissionResponse getSubmissionById(UUID submissionId) {
        User currentUser = getCurrentUser();
        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        boolean isGlobalAdmin = permissionChecker.isGlobalAdmin(currentUser.getId());
        boolean hasReviewPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "SUBMISSION:REVIEW", submission.getOrgUnit().getId());
        boolean isSubmitter = submission.getSubmittedBy().getId().equals(currentUser.getId());

        if (!isGlobalAdmin && !hasReviewPermission && !isSubmitter) {
            throw new ForbiddenException("Bạn không có quyền xem bản nộp này");
        }

        return mapToResponse(submission);
    }

    @Transactional
    public SubmissionResponse reviewSubmission(UUID submissionId, ReviewSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        if (submission.getStatus() != SubmissionStatus.PENDING) {
            throw new BusinessException("Chỉ có thể phê duyệt các bản nộp đang ở trạng thái CHỜ DUYỆT");
        }

        // Hierarchical Permission Check
        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            boolean hasReviewPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "SUBMISSION:REVIEW", submission.getOrgUnit().getId());
            if (!hasReviewPermission) {
                throw new ForbiddenException("Bạn không có quyền phê duyệt bản nộp của đơn vị này");
            }

            // Enhanced Hierarchical Rule: Check rank AND level relative to submitter
            User submitter = submission.getSubmittedBy();
            int submitterRank = permissionChecker.getMinRankInOrgUnit(submitter.getId(), submission.getOrgUnit().getId());
            int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), submission.getOrgUnit().getId());
            
            int submitterLevel = permissionChecker.getMinLevelInOrgUnit(submitter.getId(), submission.getOrgUnit().getId());
            int reviewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), submission.getOrgUnit().getId());

            // Seniority check: Reviewer must have smaller level number (Higher unit) OR same level but smaller rank number
            boolean isSuperior = (reviewerLevel < submitterLevel) || (reviewerLevel == submitterLevel && reviewerRank < submitterRank);

            if (!isSuperior) {
                throw new ForbiddenException("Bạn không thể phê duyệt bản nộp của người có cấp bậc hoặc chức vụ tương đương/cao hơn bạn");
            }
        }

        submission.setStatus(request.getStatus());
        submission.setReviewedBy(currentUser);
        submission.setReviewNote(request.getReviewNote());
        submission.setReviewedAt(Instant.now());
        submission.setManagerScore(request.getManagerScore());

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new SubmissionReviewedEvent(this, submission));

        return mapToResponse(submission);
    }

    @Transactional
    public List<SubmissionResponse> bulkReview(BulkReviewRequest request) {
        User currentUser = getCurrentUser();
        List<SubmissionResponse> results = new ArrayList<>();

        for (UUID id : request.getSubmissionIds()) {
            KpiSubmission submission = submissionRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Submission not found: " + id));

            // Apply individual overrides
            if (request.getIndividualReviews() != null) {
                request.getIndividualReviews().stream()
                        .filter(ir -> ir.getSubmissionId().equals(id))
                        .findFirst()
                        .ifPresent(ir -> {
                            if (ir.getManagerScore() != null) submission.setManagerScore(ir.getManagerScore());
                            if (ir.getReviewNote() != null) submission.setReviewNote(ir.getReviewNote());
                        });
            }

            // Fallback to common review if individual not provided
            if (submission.getManagerScore() == null && request.getCommonReview() != null) {
                submission.setManagerScore(request.getCommonReview().getManagerScore());
            }
            if (submission.getReviewNote() == null && request.getCommonReview() != null) {
                submission.setReviewNote(request.getCommonReview().getReviewNote());
            }

            submission.setStatus(request.getCommonReview() != null ? request.getCommonReview().getStatus() : SubmissionStatus.APPROVED);
            submission.setReviewedBy(currentUser);
            submission.setReviewedAt(Instant.now());

            final KpiSubmission savedSubmission = submissionRepository.save(submission);
            eventPublisher.publishEvent(new SubmissionReviewedEvent(this, savedSubmission));
            results.add(mapToResponse(savedSubmission));
        }

        return results;
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getMySubmissions(int page, int size, SubmissionStatus status, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        // Fix: Call repository with correct number of arguments (8)
        // Correct call with 7 parameters
        Page<KpiSubmission> subPage = submissionRepository.findAllWithFilters(
                currentUser.getId(), // currentUserId
                Collections.emptyList(), // allowedOrgUnitIds
                status,
                null, // kpiPeriodId
                null, // kpiCriteriaId
                currentUser.getId(), // submittedById
                null, // orgUnitPath
                0, // rank doesn't matter for self-submissions
                pageable
        );

        return PageResponse.<SubmissionResponse>builder()
                .content(subPage.getContent().stream().map(this::mapToResponse).toList())
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

    private int calculateExpected(KpiFrequency kpiFreq, KpiFrequency periodType) {
        if (kpiFreq == periodType) return 1;
        if (kpiFreq == KpiFrequency.DAILY) {
            if (periodType == KpiFrequency.MONTHLY) return 30;
            if (periodType == KpiFrequency.QUARTERLY) return 90;
            if (periodType == KpiFrequency.YEARLY) return 365;
        }
        if (kpiFreq == KpiFrequency.WEEKLY) {
            if (periodType == KpiFrequency.MONTHLY) return 4;
            if (periodType == KpiFrequency.QUARTERLY) return 13;
            if (periodType == KpiFrequency.YEARLY) return 52;
        }
        if (kpiFreq == KpiFrequency.MONTHLY) {
            if (periodType == KpiFrequency.QUARTERLY) return 3;
            if (periodType == KpiFrequency.YEARLY) return 12;
        }
        if (kpiFreq == KpiFrequency.QUARTERLY && periodType == KpiFrequency.YEARLY) return 4;
        return 1;
    }
}
