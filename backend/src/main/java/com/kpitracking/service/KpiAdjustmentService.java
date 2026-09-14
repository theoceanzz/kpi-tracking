package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateAdjustmentRequest;
import com.kpitracking.dto.request.kpi.ReviewAdjustmentRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.AdjustmentRequestResponse;
import com.kpitracking.entity.KpiAdjustmentRequest;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.User;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiAdjustmentRequestRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
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
public class KpiAdjustmentService {

    private final KpiAdjustmentRequestRepository adjustmentRepository;
    private final KpiCriteriaRepository kpiRepository;
    private final UserRepository userRepository;
    private final com.kpitracking.repository.OrgUnitRepository orgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final NotificationService notificationService;
    private final com.kpitracking.repository.UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final BscScoringService bscScoringService;
    private final com.kpitracking.workflow.KpiWorkflowConfigService workflowConfigService;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    /**
     * Tự động từ chối các yêu cầu điều chỉnh để quá hạn.
     *
     * <p>Thời hạn giờ do tổ chức đặt ({@code autoRejectAfterHours}), không còn cố định 24 giờ. Vì
     * mỗi yêu cầu có thể thuộc tổ chức khác nhau mà truy vấn chỉ nhận một mốc thời gian, ta lấy
     * rộng theo mốc NHỎ NHẤT mà cấu hình cho phép rồi lọc chính xác theo từng tổ chức. Tập này nhỏ
     * trong thực tế vì chính vòng quét này liên tục dọn nó.
     */
    private void autoRejectExpiredRequests() {
        java.time.Instant widestCutoff = java.time.Instant.now().minus(java.time.Duration.ofHours(MIN_AUTO_REJECT_HOURS));
        java.util.List<KpiAdjustmentRequest> candidates = adjustmentRepository.findByStatusAndCreatedAtBefore(
                AdjustmentStatus.PENDING, widestCutoff);

        if (candidates.isEmpty()) return;

        for (KpiAdjustmentRequest adj : candidates) {
            KpiCriteria kpi = adj.getKpiCriteria();
            int hours = autoRejectHoursFor(kpi);
            if (adj.getCreatedAt() == null
                    || adj.getCreatedAt().isAfter(java.time.Instant.now().minus(java.time.Duration.ofHours(hours)))) {
                continue;
            }

            adj.setStatus(AdjustmentStatus.REJECTED);
            adj.setReviewerNote("Tự động từ chối do quá hạn " + hours + "h. Vui lòng lên gặp trực tiếp giám đốc.");

            // Trả KPI về đúng trạng thái trước khi vào EDIT, không mặc định APPROVED.
            kpi.setStatus(statusBeforeEdit(adj));
            kpiRepository.save(kpi);

            adjustmentRepository.save(adj);
        }
    }

    /** Mốc nhỏ nhất mà {@code WorkflowConfigValidator} cho phép đặt cho thời hạn tự từ chối. */
    private static final int MIN_AUTO_REJECT_HOURS = 1;

    private UUID organizationIdOf(KpiCriteria kpi) {
        if (kpi == null || kpi.getOrgUnit() == null || kpi.getOrgUnit().getOrgHierarchyLevel() == null) return null;
        com.kpitracking.entity.Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        return org == null ? null : org.getId();
    }

    private int autoRejectHoursFor(KpiCriteria kpi) {
        return workflowConfigService.definitionFor(organizationIdOf(kpi))
                .stageConfig(com.kpitracking.workflow.WorkflowStage.CRITERIA_ADJUSTMENT)
                .intOption("autoRejectAfterHours", 24);
    }

    /**
     * Memento: trạng thái của KPI trước khi yêu cầu này đẩy nó sang EDIT.
     *
     * <p>Trước đây cả đường từ chối lẫn đường quá hạn đều đặt cứng về {@code APPROVED}, nên một
     * KPI đang ở trạng thái khác sẽ bị đổi sang APPROVED chỉ vì có người xin điều chỉnh rồi bị từ
     * chối. Dữ liệu cũ chưa có cột này thì vẫn lui về APPROVED như trước.
     */
    private static KpiStatus statusBeforeEdit(KpiAdjustmentRequest adj) {
        return adj.getPreviousKpiStatus() != null ? adj.getPreviousKpiStatus() : KpiStatus.APPROVED;
    }

    @Transactional
    public AdjustmentRequestResponse createRequest(CreateAdjustmentRequest request) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiRepository.findById(request.getKpiCriteriaId())
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", request.getKpiCriteriaId()));

        // Only assignees can request adjustment
        boolean isAssignee = kpi.getAssignees().stream().anyMatch(u -> u.getId().equals(currentUser.getId()));
        if (!isAssignee) {
            throw new ForbiddenException("Bạn không được giao thực hiện chỉ tiêu này nên không thể xin điều chỉnh.");
        }

        // Bước điều chỉnh có thể bị tổ chức tắt — chặn ngay ở cửa vào thay vì để yêu cầu treo mãi
        // vì không còn màn hình nào duyệt nó.
        if (!workflowConfigService.definitionFor(organizationIdOf(kpi))
                .isStageEnabled(com.kpitracking.workflow.WorkflowStage.CRITERIA_ADJUSTMENT)) {
            throw new BusinessException("Tổ chức đã tắt bước yêu cầu điều chỉnh trong cấu hình luồng KPI");
        }

        KpiAdjustmentRequest adj = KpiAdjustmentRequest.builder()
                .kpiCriteria(kpi)
                .requester(currentUser)
                .requestedTargetValue(request.getRequestedTargetValue())
                .requestedMinimumValue(request.getRequestedMinimumValue())
                .isDeactivationRequest(request.isDeactivationRequest())
                .reason(request.getReason())
                .status(AdjustmentStatus.PENDING)
                // Memento: nhớ trạng thái hiện tại để khi bị từ chối còn trả về đúng chỗ này.
                .previousKpiStatus(kpi.getStatus())
                .build();

        adj = adjustmentRepository.save(adj);

        // Update KPI status to EDIT
        kpi.setStatus(KpiStatus.EDIT);
        kpiRepository.save(kpi);

        // Notify the creator of the KPI
        if (kpi.getCreatedBy() != null && !kpi.getCreatedBy().getId().equals(currentUser.getId())) {
            notificationService.createNotification(
                kpi.getOrgUnit(),
                kpi.getCreatedBy(),
                "Yêu cầu điều chỉnh KPI mới",
                currentUser.getFullName() + " đã gửi yêu cầu điều chỉnh cho chỉ tiêu: " + kpi.getName(),
                "ADJUSTMENT_REQUEST",
                adj.getId()
            );
        }
        
        return mapToResponse(adj);
    }

    @Transactional
    public AdjustmentRequestResponse reviewRequest(UUID requestId, ReviewAdjustmentRequest request) {
        User currentUser = getCurrentUser();
        KpiAdjustmentRequest adj = adjustmentRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Yêu cầu điều chỉnh", "id", requestId));

        if (adj.getStatus() != AdjustmentStatus.PENDING) {
            throw new BusinessException("Yêu cầu này đã được xử lý.");
        }

        // Check permission to review
        boolean isCreator = adj.getKpiCriteria().getCreatedBy() != null &&
                           adj.getKpiCriteria().getCreatedBy().getId().equals(currentUser.getId());

        if (!permissionChecker.isGlobalAdminIn(currentUser.getId(), adj.getKpiCriteria().getOrgUnit().getId()) && !isCreator) {
            // Manager check: must have KPI:APPROVE in the org unit
            boolean hasPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE_ADJUSTMENT", adj.getKpiCriteria().getOrgUnit().getId());
            if (!hasPermission) {
                throw new ForbiddenException("Bạn không có quyền phê duyệt yêu cầu điều chỉnh cho chỉ tiêu này.");
            }

            // Hierarchical Rule: Check rank relative to requester
            User requester = adj.getRequester();
            int requesterRank = permissionChecker.getMinRankInOrgUnit(requester.getId(), adj.getKpiCriteria().getOrgUnit().getId());
            int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), adj.getKpiCriteria().getOrgUnit().getId());

            if (reviewerRank > requesterRank) {
                throw new ForbiddenException("Bạn không thể phê duyệt yêu cầu của người có chức vụ cao hơn bạn");
            }
            if (reviewerRank == requesterRank) {
                throw new ForbiddenException("Bạn không thể phê duyệt yêu cầu của người có cùng chức vụ");
            }
        }

        adj.setStatus(request.getStatus());
        adj.setReviewer(currentUser);
        adj.setReviewerNote(request.getReviewerNote());

        if (request.getStatus() == AdjustmentStatus.APPROVED) {
            KpiCriteria kpi = adj.getKpiCriteria();
            kpi.setStatus(KpiStatus.EDITED);
            if (adj.isDeactivationRequest()) {
                if (request.getCompensationPercentage() == null) {
                    throw new BusinessException("Vui lòng nhập tỷ lệ % bù trừ thành tích khi phê duyệt yêu cầu dừng KPI.");
                }
                if (request.getCompensationPercentage() < 0 || request.getCompensationPercentage() > 150) {
                    throw new BusinessException("Tỷ lệ % bù trừ thành tích phải nằm trong khoảng 0-150.");
                }
                kpi.setCompensatedAchievementPercent(request.getCompensationPercentage());
                kpi.setStatus(KpiStatus.INACTIVE);
            } else {
                if (adj.getRequestedTargetValue() != null) kpi.setTargetValue(adj.getRequestedTargetValue());
                if (adj.getRequestedMinimumValue() != null) kpi.setMinimumValue(adj.getRequestedMinimumValue());
            }
            kpiRepository.save(kpi);
        } else if (request.getStatus() == AdjustmentStatus.REJECTED) {
            KpiCriteria kpi = adj.getKpiCriteria();
            // Trả về đúng trạng thái trước khi vào EDIT (Memento), không đặt cứng APPROVED như cũ.
            kpi.setStatus(statusBeforeEdit(adj));
            kpiRepository.save(kpi);
        }

        adj = adjustmentRepository.save(adj);
        return mapToResponse(adj);
    }

    @Transactional
    public void bulkReviewRequests(com.kpitracking.dto.request.kpi.BulkReviewAdjustmentRequest request) {
        if (request.getIds() == null || request.getIds().isEmpty()) {
            return;
        }
        ReviewAdjustmentRequest singleRequest = ReviewAdjustmentRequest.builder()
                .status(request.getStatus())
                .reviewerNote(request.getReviewerNote())
                .build();
        
        for (java.util.UUID id : request.getIds()) {
            KpiAdjustmentRequest adj = adjustmentRepository.findById(id).orElse(null);
            if (adj == null) continue;
            if (adj.isDeactivationRequest()) {
                continue;
            }
            try {
                reviewRequest(id, singleRequest);
            } catch (Exception e) {
                // Log and continue or handle error
            }
        }
    }

    @Transactional
    public PageResponse<AdjustmentRequestResponse> getMyRequests(int page, int size) {
        autoRejectExpiredRequests();
        User currentUser = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<KpiAdjustmentRequest> adjPage = adjustmentRepository.findByRequesterId(currentUser.getId(), pageable);
        return PageResponse.<AdjustmentRequestResponse>builder()
                .content(adjPage.getContent().stream().map(this::mapToResponse).toList())
                .page(adjPage.getNumber())
                .size(adjPage.getSize())
                .totalElements(adjPage.getTotalElements())
                .totalPages(adjPage.getTotalPages())
                .build();
    }

    @Transactional
    public PageResponse<AdjustmentRequestResponse> getAllRequests(int page, int size, AdjustmentStatus status, UUID orgUnitId, UUID kpiPeriodId) {
        autoRejectExpiredRequests();
        User currentUser = getCurrentUser();
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "KPI:APPROVE_ADJUSTMENT");
        
        java.util.List<com.kpitracking.entity.UserRoleOrgUnit> currentAssignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        Integer currentUserRank = currentAssignments.stream()
                .map(a -> a.getRole().getRank())
                .filter(java.util.Objects::nonNull)
                .min(Integer::compare)
                .orElse(2);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<KpiAdjustmentRequest> adjPage = adjustmentRepository.findAllWithFilters(
                currentUser.getId(),
                allowedOrgUnitIds,
                status,
                orgUnitPath,
                kpiPeriodId,
                currentUserRank,
                pageable);
        return PageResponse.<AdjustmentRequestResponse>builder()
                .content(adjPage.getContent().stream().map(this::mapToResponse).toList())
                .page(adjPage.getNumber())
                .size(adjPage.getSize())
                .totalElements(adjPage.getTotalElements())
                .totalPages(adjPage.getTotalPages())
                .build();
    }

    private AdjustmentRequestResponse mapToResponse(KpiAdjustmentRequest adj) {
        com.kpitracking.entity.KpiCriteria kpi = adj.getKpiCriteria();
        com.kpitracking.entity.BscPerspective effectivePerspective =
                com.kpitracking.util.BscPerspectiveResolver.effectivePerspective(kpi);
        // %hạng_mục từ bộ tiêu chí của đơn vị KPI (để FE tính trọng số THẬT).
        Double categoryPct = null;
        if (effectivePerspective != null && kpi.getKpiPeriod() != null) {
            com.kpitracking.entity.Organization org = kpi.getKpiPeriod().getOrganization();
            if (org != null && Boolean.TRUE.equals(org.getEnableBsc())) {
                com.kpitracking.entity.BscScorecard sc = bscScoringService.resolveScorecard(
                        kpi.getOrgUnit(), org.getId(), kpi.getKpiPeriod().getId());
                if (sc != null && sc.getScorecardPerspectives() != null) {
                    for (com.kpitracking.entity.BscScorecardPerspective sp : sc.getScorecardPerspectives()) {
                        if (sp.getPerspective() != null && sp.getPerspective().getId().equals(effectivePerspective.getId())) {
                            categoryPct = sp.getWeightPercentage();
                            break;
                        }
                    }
                }
            }
        }
        return AdjustmentRequestResponse.builder()
                .id(adj.getId())
                .kpiCriteriaId(kpi.getId())
                .kpiCriteriaName(kpi.getName())
                .kpiType(kpi.getKpiType())
                .perspectiveName(effectivePerspective != null ? effectivePerspective.getName() : null)
                .perspectiveColor(effectivePerspective != null ? effectivePerspective.getColor() : null)
                .categoryWeightPercent(categoryPct)
                .currentTargetValue(adj.getKpiCriteria().getTargetValue())
                .currentWeight(adj.getKpiCriteria().getWeight())
                .currentMinimumValue(adj.getKpiCriteria().getMinimumValue())
                .requestedTargetValue(adj.getRequestedTargetValue())
                .requestedMinimumValue(adj.getRequestedMinimumValue())
                .deactivationRequest(adj.isDeactivationRequest())
                .compensationPercentage(adj.getKpiCriteria().getCompensatedAchievementPercent())
                .reason(adj.getReason())
                .status(adj.getStatus())
                .orgUnitId(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getId() : null)
                .orgUnitName(kpi.getOrgUnit() != null ? kpi.getOrgUnit().getName() : null)
                .requesterId(adj.getRequester().getId())
                .requesterName(adj.getRequester().getFullName())
                .reviewerId(adj.getReviewer() != null ? adj.getReviewer().getId() : null)
                .reviewerName(adj.getReviewer() != null ? adj.getReviewer().getFullName() : null)
                .reviewerNote(adj.getReviewerNote())
                .createdAt(adj.getCreatedAt())
                .updatedAt(adj.getUpdatedAt())
                .build();
    }
}
