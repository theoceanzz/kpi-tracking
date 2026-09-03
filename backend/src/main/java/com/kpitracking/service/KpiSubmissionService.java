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
import com.kpitracking.event.KpiEvents.KpiSubmittedEvent;
import com.kpitracking.event.KpiEvents.SubmissionReviewedEvent;
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
    private final KpiAchievementCalculator achievementCalculator;

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

        if (kpi.getStatus() == KpiStatus.INACTIVE) {
            throw new BusinessException("Chỉ tiêu KPI này đã được dừng (huỷ bỏ) và không thể nộp báo cáo mới.");
        }
        if (kpi.getStatus() != KpiStatus.APPROVED && kpi.getStatus() != KpiStatus.EDITED) {
            throw new BusinessException("Chỉ có thể nộp báo cáo cho những chỉ tiêu KPI đã được PHÊ DUYỆT hoặc ĐÃ ĐIỀU CHỈNH");
        }

        boolean isDecompositionParent = kpi.getChildren() != null && kpi.getChildren().stream()
                .anyMatch(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION);
        if (isDecompositionParent) {
            throw new BusinessException("KPI này đã được chia thành các KPI con. Vui lòng nộp báo cáo ở từng KPI con tương ứng.");
        }

        boolean isAssignee = kpi.getAssignees().stream()
                .anyMatch(u -> u.getId().equals(currentUser.getId()));
        if (!isAssignee) {
            throw new ForbiddenException("Bạn không được giao thực hiện chỉ tiêu KPI này");
        }

        // Quantitative KPIs require a numeric actual value; qualitative KPIs do not
        // (they are scored later by the reviewer picking a qualitative level).
        if (kpi.getKpiType() != com.kpitracking.enums.KpiType.QUALITATIVE && request.getActualValue() == null) {
            throw new BusinessException("Vui lòng nhập giá trị thực tế cho chỉ tiêu định lượng.");
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
        if (kpi.getFrequency() != KpiFrequency.UNLIMITED) {
            long currentCount = kpi.getSubmissions().stream()
                    .filter(s -> s.getDeletedAt() == null &&
                            s.getSubmittedBy().getId().equals(currentUser.getId()) &&
                            (s.getStatus() == SubmissionStatus.PENDING ||
                             s.getStatus() == SubmissionStatus.APPROVED ||
                             s.getStatus() == SubmissionStatus.REJECTED))
                    .count();

            int expected = 1;
            if (kpi.getFrequency() != null && kpi.getKpiPeriod() != null) {
                expected = calculateExpected(kpi.getFrequency(), kpi.getKpiPeriod().getPeriodType());
            }

            if (currentCount >= expected) {
                throw new BusinessException("Bạn đã nộp đủ số lượng báo cáo cho chỉ tiêu này (" + currentCount + "/" + expected + ").");
            }
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
            boolean isInverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());

            // Vi phạm ngưỡng ⇒ tự động TỪ CHỐI. Quy tắc ngưỡng lấy từ KpiAchievementCalculator
            // để autoScore và system_score/bsc_score dùng CHUNG một công thức, không lệch nhau.
            if (achievementCalculator.breachesThreshold(kpi, request.getActualValue())) {
                finalStatus = SubmissionStatus.REJECTED;
                autoReviewNote = isInverse
                        ? "Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + request.getActualValue()
                          + ") vượt quá mức tối đa cho phép (" + minVal + ")."
                        : "Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + request.getActualValue()
                          + ") thấp hơn mức tối thiểu yêu cầu (" + minVal + ").";
                reviewedAt = Instant.now();
            }

            // autoScore luôn tính bằng công thức chung (vi phạm ngưỡng ⇒ ratio = 0).
            // Trọng số CHÍNH LÀ điểm: đạt đủ KPI 25% ⇒ 25đ. Thang điểm của tổ chức không
            // nhân vào đây nữa — nó chỉ là mẫu số xếp loại (xem EvaluationService.SCORING_POOL).
            autoScore = achievementCalculator.ratioFromActual(kpi, request.getActualValue()) * kpi.getWeight();
        }
        
        // If it's a draft, don't trigger auto-rejection yet
        if (Boolean.TRUE.equals(request.getIsDraft())) {
            finalStatus = SubmissionStatus.DRAFT;
            autoReviewNote = null;
            reviewedAt = null;
        }

        // Qualitative self-assessment: employee picks a level from the org scale.
        com.kpitracking.entity.QualitativeLevel selfLevel = null;
        if (kpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE && request.getQualitativeLevelId() != null) {
            com.kpitracking.entity.Organization submitOrg = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
            selfLevel = submitOrg.getQualitativeLevels().stream()
                    .filter(l -> l.getId().equals(request.getQualitativeLevelId()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException("Mức đánh giá định tính không hợp lệ."));
        }

        KpiSubmission submission = KpiSubmission.builder()
                .orgUnit(kpi.getOrgUnit())
                .kpiCriteria(kpi)
                .submittedBy(currentUser)
                .actualValue(request.getActualValue())
                .qualitativeLevel(selfLevel)
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
        boolean isManager = permissionChecker.hasAnyPermission(submission.getSubmittedBy().getId(), "SUBMISSION:REVIEW");
        res.setSubmittedByManager(isManager);
        return res;
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getSubmissions(int page, int size, SubmissionStatus status, UUID kpiPeriodId, UUID kpiCriteriaId, UUID submittedById, UUID orgUnitId, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithAnyPermission(currentUser.getId(), "SUBMISSION:REVIEW", "SUBMISSION:REVIEW_KPI");


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
        
        Integer currentUserLevel = currentAssignments.stream()
                .map(a -> a.getRole().getLevel())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(4);

        Page<KpiSubmission> subPage = submissionRepository.findAllWithFilters(
                currentUser.getId(),
                allowedOrgUnitIds,
                status,
                kpiPeriodId,
                kpiCriteriaId,
                submittedById,
                orgUnitPath,
                currentUserRank,
                currentUserLevel,
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

        if (submission.getKpiCriteria().getStatus() == KpiStatus.INACTIVE) {
            throw new BusinessException("Chỉ tiêu KPI này đã được dừng (huỷ bỏ) và không thể chỉnh sửa bản nộp.");
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
            KpiCriteria submitKpi = submission.getKpiCriteria();
            Instant nowSubmit = Instant.now();
            if (submitKpi.getKpiPeriod() != null && submitKpi.getKpiPeriod().getEndDate() != null
                    && nowSubmit.isAfter(submitKpi.getKpiPeriod().getEndDate())) {
                throw new BusinessException("Kỳ đánh giá đã kết thúc. Bạn không thể nộp báo cáo cho kỳ này nữa.");
            }

            submission.setStatus(SubmissionStatus.PENDING);

            // Re-calculate auto score/rejection
            KpiCriteria kpi = submission.getKpiCriteria();
            if (submission.getActualValue() != null && kpi.getTargetValue() != null && kpi.getWeight() != null && kpi.getTargetValue() != 0) {
                Double minVal = kpi.getMinimumValue() != null ? kpi.getMinimumValue() : 0.0;
                boolean isInverse = Boolean.TRUE.equals(kpi.getIsReverseKpi());

                // Dùng chung quy tắc ngưỡng + công thức với KpiAchievementCalculator (xem create ở trên).
                if (achievementCalculator.breachesThreshold(kpi, submission.getActualValue())) {
                    submission.setStatus(SubmissionStatus.REJECTED);
                    submission.setReviewNote(isInverse
                            ? "Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + submission.getActualValue()
                              + ") vượt quá mức tối đa cho phép (" + minVal + ")."
                            : "Hệ thống tự động TỪ CHỐI do số liệu thực tế (" + submission.getActualValue()
                              + ") thấp hơn mức tối thiểu yêu cầu (" + minVal + ").");
                    submission.setReviewedAt(Instant.now());
                }

                submission.setAutoScore(
                        achievementCalculator.ratioFromActual(kpi, submission.getActualValue()) * kpi.getWeight());
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
        boolean hasReviewPermission = permissionChecker.hasAnyPermissionInOrgUnit(currentUser.getId(), submission.getOrgUnit().getId(), "SUBMISSION:REVIEW");
        boolean isSubmitter = submission.getSubmittedBy().getId().equals(currentUser.getId());

        if (!isGlobalAdmin && !hasReviewPermission && !isSubmitter) {
            throw new ForbiddenException("Bạn không có quyền xem bản nộp này");
        }

        return mapToResponse(submission);
    }

    /**
     * Ai được phép phê duyệt bản nộp này. Ném nếu không.
     *
     * <p><b>Tách ra vì nó từng chỉ được gọi ở MỘT trong hai đường duyệt.</b> {@link #bulkReview}
     * không kiểm gì cả — không quyền theo đơn vị, không cấp bậc — mà endpoint của nó cũng không có
     * {@code @PreAuthorize}. Nghĩa là bất kỳ người dùng đã đăng nhập nào cũng duyệt được bản nộp bất
     * kỳ theo id, xuyên đơn vị và xuyên tổ chức, chỉ bằng cách gọi bản HÀNG LOẠT thay vì bản đơn lẻ.
     * Hai đường vào cùng một hành động thì phải qua cùng một cửa, nếu không cửa nào chặt hơn cũng
     * chỉ là trang trí.
     *
     * <p>Bốn luật, giữ nguyên từng chữ từ bản đơn lẻ:
     * <ol>
     *   <li>quản trị toàn hệ thống đi thẳng;</li>
     *   <li>phải có {@code SUBMISSION:REVIEW} <b>trong chính đơn vị của bản nộp</b> — có quyền ở
     *       đơn vị khác không tính;</li>
     *   <li>phải cao hơn NGƯỜI NỘP về cấp đơn vị hoặc chức vụ; ngang hàng là không được, nên cũng
     *       không ai tự duyệt bản nộp của chính mình;</li>
     *   <li>bản đã duyệt rồi thì chỉ người cao hơn NGƯỜI DUYỆT TRƯỚC mới ghi đè được.</li>
     * </ol>
     */
    private void requireCanReview(User currentUser, KpiSubmission submission) {
        // Quản trị toàn hệ thống ghi đè được cả bản người khác đã duyệt — đúng như bản đơn lẻ vẫn làm.
        if (permissionChecker.isGlobalAdmin(currentUser.getId())) return;

        UUID unitId = submission.getOrgUnit().getId();
        if (!permissionChecker.hasAnyPermissionInOrgUnit(currentUser.getId(), unitId, "SUBMISSION:REVIEW")) {
            throw new ForbiddenException("Bạn không có quyền phê duyệt bản nộp của đơn vị này");
        }

        User submitter = submission.getSubmittedBy();
        int submitterRank = permissionChecker.getMinRankInOrgUnit(submitter.getId(), unitId);
        int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), unitId);
        int submitterLevel = permissionChecker.getMinLevelInOrgUnit(submitter.getId(), unitId);
        int reviewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), unitId);

        // Số NHỎ hơn là cao hơn, ở cả hai trục. Cấp đơn vị xét trước, cùng cấp mới xét tới chức vụ.
        boolean isSuperiorToSubmitter = (reviewerLevel < submitterLevel)
                || (reviewerLevel == submitterLevel && reviewerRank < submitterRank);
        if (!isSuperiorToSubmitter) {
            throw new ForbiddenException(
                    "Bạn không thể phê duyệt bản nộp của người có cấp bậc hoặc chức vụ tương đương/cao hơn bạn");
        }

        if (submission.getStatus() == SubmissionStatus.APPROVED && submission.getReviewedBy() != null) {
            User prevReviewer = submission.getReviewedBy();
            int prevReviewerRank = permissionChecker.getMinRankInOrgUnit(prevReviewer.getId(), unitId);
            int prevReviewerLevel = permissionChecker.getMinLevelInOrgUnit(prevReviewer.getId(), unitId);
            boolean isSuperiorToPrevReviewer = (reviewerLevel < prevReviewerLevel)
                    || (reviewerLevel == prevReviewerLevel && reviewerRank < prevReviewerRank);
            if (!isSuperiorToPrevReviewer) {
                throw new BusinessException("Bản nộp này đã được cấp quản lý tương đương hoặc cao hơn phê duyệt.");
            }
        }
    }

    @Transactional
    public SubmissionResponse reviewSubmission(UUID submissionId, ReviewSubmissionRequest request) {
        User currentUser = getCurrentUser();

        KpiSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Bản nộp", "id", submissionId));

        requireCanReview(currentUser, submission);

        if (submission.getStatus() != SubmissionStatus.PENDING && submission.getStatus() != SubmissionStatus.APPROVED) {
            throw new BusinessException("Chỉ có thể phê duyệt các bản nộp đang ở trạng thái CHỜ DUYỆT hoặc đã ĐÃ DUYỆT (để ghi đè)");
        }

        submission.setStatus(request.getStatus());
        submission.setReviewedBy(currentUser);
        submission.setReviewNote(request.getReviewNote());
        submission.setReviewedAt(Instant.now());

        // Qualitative KPIs are scored by the reviewer picking a level from the org's
        // qualitative scale; the level's value is normalized into the same weighted
        // score as quantitative KPIs so it folds into the total system score.
        com.kpitracking.entity.KpiCriteria reviewedKpi = submission.getKpiCriteria();
        if (reviewedKpi.getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE
                && request.getQualitativeLevelId() != null) {
            applyQualitativeScore(submission, request.getQualitativeLevelId());
        } else {
            submission.setManagerScore(request.getManagerScore());
        }

        submission = submissionRepository.save(submission);

        eventPublisher.publishEvent(new SubmissionReviewedEvent(this, submission));

        // Auto-rollup for Waterfall Mode
        com.kpitracking.entity.KpiCriteria kpi = submission.getKpiCriteria();
        KpiSubmission parentSub = null;
        Boolean allChildrenApproved = false;

        if (kpi.getParent() != null) {
            com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
            if (org != null && Boolean.TRUE.equals(org.getEnableWaterfall())) {
                parentSub = aggregateToParentKpi(kpi.getParent(), submission.getPeriodStart(), submission.getPeriodEnd());
                
                // Check if all children of the parent KPI are approved
                List<com.kpitracking.entity.KpiCriteria> children = kpiCriteriaRepository.findByParentId(kpi.getParent().getId());
                boolean allApproved = true;
                for (com.kpitracking.entity.KpiCriteria child : children) {
                    List<KpiSubmission> childSubs = submissionRepository.findByKpiCriteriaIdAndDeletedAtIsNull(child.getId());
                    if (childSubs.isEmpty() || childSubs.stream().noneMatch(s -> s.getStatus() == SubmissionStatus.APPROVED)) {
                        allApproved = false;
                        break;
                    }
                }
                allChildrenApproved = allApproved;
            }
        }

        SubmissionResponse response = mapToResponse(submission);
        if (parentSub != null) {
            response.setParentSubmissionId(parentSub.getId());
            User parentAssignee = kpi.getParent().getAssignees().isEmpty() ? kpi.getParent().getCreatedBy() : kpi.getParent().getAssignees().get(0);
            if (parentAssignee != null && parentAssignee.getId().equals(currentUser.getId())) {
                response.setAllChildrenApproved(allChildrenApproved);
            } else {
                response.setAllChildrenApproved(false);
            }
        }

        return response;
    }

    private KpiSubmission aggregateToParentKpi(com.kpitracking.entity.KpiCriteria parentKpi, Instant periodStart, Instant periodEnd) {
        // Sum all APPROVED actual values of child KPIs
        List<com.kpitracking.entity.KpiCriteria> children = kpiCriteriaRepository.findByParentId(parentKpi.getId());
        double totalActual = 0.0;
        for (com.kpitracking.entity.KpiCriteria child : children) {
            List<KpiSubmission> childSubs = submissionRepository.findByKpiCriteriaIdAndDeletedAtIsNull(child.getId());
            totalActual += childSubs.stream()
                    .filter(s -> s.getStatus() == SubmissionStatus.APPROVED)
                    .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                    .sum();
        }

        // Get the leader (the creator or the first assignee of the parent KPI)
        User parentAssignee = parentKpi.getAssignees().isEmpty() ? parentKpi.getCreatedBy() : parentKpi.getAssignees().get(0);

        // Find existing parent submission
        List<KpiSubmission> parentSubs = submissionRepository.findByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(parentKpi.getId(), parentAssignee.getId());
        KpiSubmission parentSub;
        if (!parentSubs.isEmpty()) {
            parentSub = parentSubs.get(0);
            if (parentSub.getStatus() == SubmissionStatus.DRAFT) {
                parentSub.setStatus(SubmissionStatus.PENDING);
            }
        } else {
            parentSub = KpiSubmission.builder()
                    .orgUnit(parentKpi.getOrgUnit())
                    .kpiCriteria(parentKpi)
                    .submittedBy(parentAssignee)
                    .periodStart(periodStart)
                    .periodEnd(periodEnd)
                    .status(SubmissionStatus.PENDING) // Auto-created as pending for upper review
                    .build();
        }

        parentSub.setActualValue(totalActual);
        
        Double autoScore = 0.0;
        if (parentKpi.getTargetValue() != null && parentKpi.getWeight() != null && parentKpi.getTargetValue() != 0) {
            // Dùng chung công thức với KpiAchievementCalculator (đã gồm bù trừ, ngưỡng, KPI ngược, trần).
            autoScore = achievementCalculator.ratioFromActual(parentKpi, totalActual) * parentKpi.getWeight();
        }
        parentSub.setAutoScore(autoScore);

        if (parentSub.getId() == null) {
            parentSub.setNote("Tự động tổng hợp từ kết quả của nhân viên");
        } else {
            parentSub.setNote("Đã cập nhật tự động từ kết quả của nhân viên");
        }

        return submissionRepository.save(parentSub);
    }

    /** Resolve the org qualitative level, set it on the submission and derive the weighted managerScore. */
    private void applyQualitativeScore(KpiSubmission submission, UUID levelId) {
        com.kpitracking.entity.KpiCriteria kpi = submission.getKpiCriteria();
        com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        com.kpitracking.entity.QualitativeLevel level = org.getQualitativeLevels().stream()
                .filter(l -> l.getId().equals(levelId))
                .findFirst()
                .orElseThrow(() -> new BusinessException("Mức đánh giá định tính không hợp lệ."));
        double maxLevelValue = org.getQualitativeLevels().stream()
                .mapToDouble(l -> l.getValue() != null ? l.getValue() : 0.0)
                .max().orElse(0.0);
        double weight = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
        double ratio = maxLevelValue > 0 ? (level.getValue() / maxLevelValue) : 0.0;
        submission.setQualitativeLevel(level);
        submission.setManagerScore(ratio * weight);
    }

    @Transactional
    public List<SubmissionResponse> bulkReview(BulkReviewRequest request) {
        User currentUser = getCurrentUser();
        List<SubmissionResponse> results = new ArrayList<>();

        for (UUID id : request.getSubmissionIds()) {
            KpiSubmission submission = submissionRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Submission not found: " + id));

            // Kiểm TỪNG bản một, không kiểm một lần cho cả lô: danh sách id do client gửi lên và
            // không có gì buộc chúng thuộc cùng một đơn vị. Kiểm theo bản đầu rồi cho qua phần còn
            // lại chính là lỗ hổng cũ mặc một cái áo mới.
            requireCanReview(currentUser, submission);

            // Apply individual overrides
            if (request.getIndividualReviews() != null) {
                request.getIndividualReviews().stream()
                        .filter(ir -> ir.getSubmissionId().equals(id))
                        .findFirst()
                        .ifPresent(ir -> {
                            if (ir.getQualitativeLevelId() != null
                                    && submission.getKpiCriteria().getKpiType() == com.kpitracking.enums.KpiType.QUALITATIVE) {
                                applyQualitativeScore(submission, ir.getQualitativeLevelId());
                            } else if (ir.getManagerScore() != null) {
                                submission.setManagerScore(ir.getManagerScore());
                            }
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
            
            // Auto-rollup for Waterfall Mode
            com.kpitracking.entity.KpiCriteria kpi = savedSubmission.getKpiCriteria();
            KpiSubmission parentSub = null;
            Boolean allChildrenApproved = false;

            if (kpi.getParent() != null) {
                com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
                if (org != null && Boolean.TRUE.equals(org.getEnableWaterfall())) {
                    parentSub = aggregateToParentKpi(kpi.getParent(), savedSubmission.getPeriodStart(), savedSubmission.getPeriodEnd());
                    
                    // Check if all children of the parent KPI have approved submissions
                    List<com.kpitracking.entity.KpiCriteria> children = kpiCriteriaRepository.findByParentId(kpi.getParent().getId());
                    boolean allApproved = true;
                    for (com.kpitracking.entity.KpiCriteria child : children) {
                        List<KpiSubmission> childSubs = submissionRepository.findByKpiCriteriaIdAndDeletedAtIsNull(child.getId());
                        if (childSubs.isEmpty() || childSubs.stream().noneMatch(s -> s.getStatus() == SubmissionStatus.APPROVED)) {
                            allApproved = false;
                            break;
                        }
                    }
                    allChildrenApproved = allApproved;
                }
            }

            SubmissionResponse resp = mapToResponse(savedSubmission);
            if (parentSub != null) {
                resp.setParentSubmissionId(parentSub.getId());
                User parentAssignee = kpi.getParent().getAssignees().isEmpty() ? kpi.getParent().getCreatedBy() : kpi.getParent().getAssignees().get(0);
                if (parentAssignee != null && parentAssignee.getId().equals(currentUser.getId())) {
                    resp.setAllChildrenApproved(allChildrenApproved);
                } else {
                    resp.setAllChildrenApproved(false);
                }
            }
            results.add(resp);
        }

        return results;
    }

    @Transactional(readOnly = true)
    public PageResponse<SubmissionResponse> getMySubmissions(int page, int size, SubmissionStatus status, UUID kpiPeriodId, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<KpiSubmission> subPage = submissionRepository.findAllWithFilters(
                currentUser.getId(), // currentUserId
                Collections.emptyList(), // allowedOrgUnitIds
                status,
                kpiPeriodId, // kpiPeriodId
                null, // kpiCriteriaId
                currentUser.getId(), // submittedById
                null, // orgUnitPath
                0, // rank
                0, // level (0 means bypass hierarchical checks since it's self-submission)
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
        if (kpiFreq == KpiFrequency.UNLIMITED) return Integer.MAX_VALUE;
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
