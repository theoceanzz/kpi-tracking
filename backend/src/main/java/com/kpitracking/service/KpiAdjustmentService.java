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

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private void autoRejectExpiredRequests() {
        java.time.Instant twentyFourHoursAgo = java.time.Instant.now().minus(java.time.Duration.ofDays(1));
        java.util.List<KpiAdjustmentRequest> expiredRequests = adjustmentRepository.findByStatusAndCreatedAtBefore(
                AdjustmentStatus.PENDING, twentyFourHoursAgo);
        
        if (expiredRequests.isEmpty()) return;

        for (KpiAdjustmentRequest adj : expiredRequests) {
            adj.setStatus(AdjustmentStatus.REJECTED);
            adj.setReviewerNote("Tự động từ chối do quá hạn 24h. Vui lòng lên gặp trực tiếp giám đốc.");
            
            // Revert KPI status
            KpiCriteria kpi = adj.getKpiCriteria();
            kpi.setStatus(KpiStatus.APPROVED);
            kpiRepository.save(kpi);
            
            adjustmentRepository.save(adj);
        }
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

        KpiAdjustmentRequest adj = KpiAdjustmentRequest.builder()
                .kpiCriteria(kpi)
                .requester(currentUser)
                .requestedTargetValue(request.getRequestedTargetValue())
                .requestedMinimumValue(request.getRequestedMinimumValue())
                .isDeactivationRequest(request.isDeactivationRequest())
                .reason(request.getReason())
                .status(AdjustmentStatus.PENDING)
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

        // Check permission to review (Manager of the org unit)
        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            boolean hasPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE", adj.getKpiCriteria().getOrgUnit().getId());
            if (!hasPermission) {
                throw new ForbiddenException("Bạn không có quyền phê duyệt yêu cầu điều chỉnh của đơn vị này.");
            }

            // Enhanced Hierarchical Rule: Check rank relative to requester
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
                // If it's a deactivation request, we might want to set weight to 0 or mark as inactive
                // For now, let's just set weight to 0 and status to INACTIVE if it's a total skip
                kpi.setWeight(0.0);
                kpi.setStatus(KpiStatus.INACTIVE); // Optional: depends on business if we want to hide it
            } else {
                if (adj.getRequestedTargetValue() != null) kpi.setTargetValue(adj.getRequestedTargetValue());
                if (adj.getRequestedMinimumValue() != null) kpi.setMinimumValue(adj.getRequestedMinimumValue());
            }
            kpiRepository.save(kpi);
        } else if (request.getStatus() == AdjustmentStatus.REJECTED) {
            KpiCriteria kpi = adj.getKpiCriteria();
            kpi.setStatus(KpiStatus.APPROVED);
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
        java.util.List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "KPI:APPROVE");
        
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
        return AdjustmentRequestResponse.builder()
                .id(adj.getId())
                .kpiCriteriaId(adj.getKpiCriteria().getId())
                .kpiCriteriaName(adj.getKpiCriteria().getName())
                .currentTargetValue(adj.getKpiCriteria().getTargetValue())
                .currentWeight(adj.getKpiCriteria().getWeight())
                .currentMinimumValue(adj.getKpiCriteria().getMinimumValue())
                .requestedTargetValue(adj.getRequestedTargetValue())
                .requestedMinimumValue(adj.getRequestedMinimumValue())
                .deactivationRequest(adj.isDeactivationRequest())
                .reason(adj.getReason())
                .status(adj.getStatus())
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
