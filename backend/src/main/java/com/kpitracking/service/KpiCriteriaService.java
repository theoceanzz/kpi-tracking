package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.ImportKpiResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.event.KpiCriteriaApprovedEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiPeriodRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.mapper.KpiCriteriaMapper;
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
import org.springframework.web.multipart.MultipartFile;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.Instant;
import org.apache.poi.ss.usermodel.DataFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class KpiCriteriaService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiPeriodRepository kpiPeriodRepository;
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

        // Permission check: only users with KPI:CREATE in the target OrgUnit can create
        if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnit.getId())) {
            throw new ForbiddenException("Bạn không có quyền tạo chỉ tiêu cho đơn vị này.");
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

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));

        if (request.getFrequency().ordinal() > kpiPeriod.getPeriodType().ordinal()) {
            throw new BusinessException("Tần suất đánh giá (Tháng/Quý/Năm) phải nhỏ hơn hoặc bằng loại kỳ đánh giá (Đợt).");
        }

        KpiCriteria kpi = buildKpiEntity(request, orgUnit, assignees, currentUser, initialStatus, kpiPeriod);
        kpi = kpiCriteriaRepository.save(kpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    private KpiCriteria buildKpiEntity(CreateKpiCriteriaRequest request, OrgUnit orgUnit, java.util.List<User> assignees, User creator, KpiStatus status, com.kpitracking.entity.KpiPeriod kpiPeriod) {
        KpiCriteria kpi = KpiCriteria.builder()
                .orgUnit(orgUnit)
                .assignees(assignees)
                .name(request.getName())
                .description(request.getDescription())
                .weight(request.getWeight())
                .targetValue(request.getTargetValue())
                .minimumValue(request.getMinimumValue())
                .unit(request.getUnit())
                .frequency(request.getFrequency())
                .status(status)
                .createdBy(creator)
                .kpiPeriod(kpiPeriod)
                .build();

        if (status == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }
        return kpi;
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId, UUID createdById, UUID kpiPeriodId, String keyword, Instant startDate, Instant endDate, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        List<UUID> allowedOrgUnitIds = permissionChecker.getOrgUnitsWithPermission(currentUser.getId(), "KPI:VIEW");

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

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findAllWithFilters(
                allowedOrgUnitIds, 
                createdById, 
                orgUnitPath, 
                status, 
                kpiPeriodId, 
                keyword,
                currentUser.getId(),
                currentUserRank,
                currentUserLevel,
                startDate,
                endDate,
                pageable
        );

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
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));
        
        // Permission check for viewing single KPI
        boolean hasViewPermission = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", kpi.getOrgUnit().getId());
        boolean isAssignee = kpi.getAssignees().stream().anyMatch(a -> a.getId().equals(currentUser.getId()));
        
        if (!hasViewPermission && !isAssignee && !kpi.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new ForbiddenException("Bạn không có quyền xem KPI này");
        }
        
        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        boolean canUpdate = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:UPDATE", kpi.getOrgUnit().getId());
        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());

        if (!isCreator && !canUpdate) {
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa KPI này");
        }

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
            throw new BusinessException("Chỉ có thể cập nhật KPI ở trạng thái NHÁP hoặc BỊ TỪ CHỐI");
        }

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getMinimumValue() != null) kpi.setMinimumValue(request.getMinimumValue());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());
        
        if (request.getKpiPeriodId() != null) {
            com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));
            kpi.setKpiPeriod(kpiPeriod);
        }

        if (request.getFrequency() != null) {
            if (request.getFrequency().ordinal() > kpi.getKpiPeriod().getPeriodType().ordinal()) {
                throw new BusinessException("Tần suất đánh giá (Tháng/Quý/Năm) phải nhỏ hơn hoặc bằng loại kỳ đánh giá (Đợt).");
            }
            kpi.setFrequency(request.getFrequency());
        }

        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", request.getOrgUnitId()));
            
            // Check if user has permission to move KPI to this new OrgUnit
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnit.getId())) {
                throw new ForbiddenException("Bạn không có quyền tạo/chuyển KPI cho đơn vị mới này");
            }
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

        // Validate that total weight for this org unit and period is exactly 100%
        Double totalWeight = kpiCriteriaRepository.sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(
                kpi.getOrgUnit().getId(),
                kpi.getKpiPeriod().getId(),
                java.util.Arrays.asList(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED, KpiStatus.EDIT, KpiStatus.EDITED)
        );

        if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
            throw new BusinessException("Tổng trọng số của tất cả KPI trong phòng ban/nhóm cho đợt này phải bằng chính xác 100%. Hiện tại: " + (totalWeight != null ? totalWeight : 0) + "%");
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
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE", kpi.getOrgUnit().getId())) {
                throw new ForbiddenException("Bạn không có quyền phê duyệt chỉ tiêu KPI cho đơn vị này");
            }

            // Enhanced Hierarchical Rule: Check level and rank relative to creator
            User creator = kpi.getCreatedBy();
            int creatorLevel = permissionChecker.getMinLevelInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());
            int creatorRank = permissionChecker.getMinRankInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());
            
            int reviewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());
            int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());

            // Reviewer must have a better level (lower number) OR same level and better rank
            boolean isSuperior = reviewerLevel < creatorLevel || (reviewerLevel == creatorLevel && reviewerRank < creatorRank);

            if (!isSuperior) {
                if (reviewerLevel > creatorLevel) {
                    throw new ForbiddenException("Bạn không thể phê duyệt chỉ tiêu của người có cấp bậc cao hơn bạn");
                } else if (reviewerLevel == creatorLevel && reviewerRank == creatorRank) {
                    throw new ForbiddenException("Bạn không thể phê duyệt chỉ tiêu của người có cùng chức vụ");
                } else {
                    throw new ForbiddenException("Bạn không đủ thẩm quyền để phê duyệt chỉ tiêu này");
                }
            }
        }

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
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE", kpi.getOrgUnit().getId())) {
                throw new ForbiddenException("Bạn không có quyền từ chối chỉ tiêu KPI cho đơn vị này");
            }

            // Enhanced Hierarchical Rule: Check level and rank relative to creator
            User creator = kpi.getCreatedBy();
            int creatorLevel = permissionChecker.getMinLevelInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());
            int creatorRank = permissionChecker.getMinRankInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());
            
            int reviewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());
            int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());

            // Reviewer must have a better level (lower number) OR same level and better rank
            boolean isSuperior = reviewerLevel < creatorLevel || (reviewerLevel == creatorLevel && reviewerRank < creatorRank);

            if (!isSuperior) {
                if (reviewerLevel > creatorLevel) {
                    throw new ForbiddenException("Bạn không thể từ chối chỉ tiêu của người có cấp bậc cao hơn bạn");
                } else if (reviewerLevel == creatorLevel && reviewerRank == creatorRank) {
                    throw new ForbiddenException("Bạn không thể từ chối chỉ tiêu của người có cùng chức vụ");
                } else {
                    throw new ForbiddenException("Bạn không đủ thẩm quyền để từ chối chỉ tiêu này");
                }
            }
        }

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
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        boolean canDelete = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:DELETE", kpi.getOrgUnit().getId());
        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());

        if (!isCreator && !canDelete) {
            throw new ForbiddenException("Bạn không có quyền xoá KPI này");
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size, UUID kpiPeriodId, Instant startDate, Instant endDate, String sortBy, String sortDir) {
        User currentUser = getCurrentUser();
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT);
        Page<KpiCriteria> kpiPage;
        if (kpiPeriodId != null) {
            kpiPage = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodIdWithDate(
                    currentUser.getId(), kpiPeriodId, activeStatuses, startDate, endDate, pageable);
        } else {
            kpiPage = kpiCriteriaRepository.findByUserIdInAssigneesWithDate(
                    currentUser.getId(), activeStatuses, startDate, endDate, pageable);
        }

        List<KpiCriteriaResponse> content = kpiPage.getContent().stream()
                .map(kpi -> {
                    KpiCriteriaResponse response = kpiCriteriaMapper.toResponse(kpi);
                    if (kpi.getSubmissions() != null) {
                        int userSubCount = (int) kpi.getSubmissions().stream()
                                .filter(s -> s.getDeletedAt() == null && 
                                        s.getSubmittedBy().getId().equals(currentUser.getId()) &&
                                        (s.getStatus() == com.kpitracking.enums.SubmissionStatus.PENDING || 
                                         s.getStatus() == com.kpitracking.enums.SubmissionStatus.APPROVED ||
                                         s.getStatus() == com.kpitracking.enums.SubmissionStatus.REJECTED))
                                .count();
                        response.setSubmissionCount(userSubCount);
                    }
                    return response;
                })
                .toList();

        return PageResponse.<KpiCriteriaResponse>builder()
                .content(content)
                .page(kpiPage.getNumber())
                .size(kpiPage.getSize())
                .totalElements(kpiPage.getTotalElements())
                .totalPages(kpiPage.getTotalPages())
                .last(kpiPage.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public Double getTotalWeight(UUID orgUnitId, UUID userId, UUID kpiPeriodId) {
        User currentUser = getCurrentUser();
        
        List<KpiStatus> statuses = java.util.Arrays.asList(
                KpiStatus.DRAFT, 
                KpiStatus.PENDING_APPROVAL, 
                KpiStatus.APPROVED, 
                KpiStatus.REJECTED, 
                KpiStatus.EDIT, 
                KpiStatus.EDITED
        );

        if (userId != null) {
            // Permission check: can only see other user's weight if has KPI:VIEW for their org unit
            // or if it's the current user themselves
            if (!currentUser.getId().equals(userId)) {
                User targetUser = userRepository.findById(userId)
                        .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", userId));
                
                // Simplified: if they have any permission in any of the target user's units
                boolean hasPermission = false;
                List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(targetUser.getId());
                for (UserRoleOrgUnit assignment : assignments) {
                    if (permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", assignment.getOrgUnit().getId())) {
                        hasPermission = true;
                        break;
                    }
                }
                
                if (!hasPermission && !permissionChecker.isGlobalAdmin(currentUser.getId())) {
                    throw new ForbiddenException("Bạn không có quyền xem thông tin trọng số của người dùng này");
                }
            }
            return kpiCriteriaRepository.sumWeightByUserIdAndKpiPeriodIdAndStatusIn(userId, kpiPeriodId, statuses);
        }

        if (orgUnitId != null) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", orgUnitId)) {
                throw new ForbiddenException("Bạn không có quyền xem thông tin trọng số của đơn vị này");
            }

            return kpiCriteriaRepository.sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(orgUnitId, kpiPeriodId, statuses);
        }
        
        return 0.0;
    }

    @Transactional
    public ImportKpiResponse importKpis(MultipartFile file, UUID kpiPeriodId, UUID orgUnitId) {
        User currentUser = getCurrentUser();
        // Track modified units and periods to validate weight after import
        java.util.Set<String> affectedPairs = new java.util.HashSet<>();
        java.util.Set<String> affectedUserPairs = new java.util.HashSet<>();
        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodId != null ? 
                kpiPeriodRepository.findById(kpiPeriodId).orElse(null) : null;
        OrgUnit orgUnit = orgUnitId != null ? 
                orgUnitRepository.findById(orgUnitId).orElse(null) : null;
        
        // Get current user's organization ID for lookups
        UUID userOrgId = null;
        if (orgUnit != null) {
            userOrgId = orgUnit.getOrgHierarchyLevel().getOrganization().getId();
        } else {
            java.util.List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                userOrgId = assignments.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
            }
        }

        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx"))) {
            throw new BusinessException("Chỉ hỗ trợ tập tin định dạng .csv và .xlsx");
        }

        List<String> errors = new ArrayList<>();
        int successfulImports = 0;
        int totalRows = 0;

        // canApprove will be determined per unit in processKpiRow

        try {
            if (filename.endsWith(".csv")) {
                try (BufferedReader fileReader = new BufferedReader(new InputStreamReader(file.getInputStream(), "UTF-8"));
                     CSVParser csvParser = new CSVParser(fileReader, CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).setIgnoreHeaderCase(true).setTrim(true).build())) {
                    for (CSVRecord record : csvParser) {
                        totalRows++;
                        try {
                            processKpiRow(
                                record.get("Name"), 
                                record.isMapped("Description") ? record.get("Description") : null, 
                                record.get("Weight"), 
                                record.get("TargetValue"),
                                record.isMapped("MinimumValue") ? record.get("MinimumValue") : null,
                                record.isMapped("Unit") ? record.get("Unit") : null, 
                                record.get("Frequency"), 
                                record.get("EmployeeCode"), 
                                record.isMapped("Period") ? record.get("Period") : null,
                                record.isMapped("OrgUnit") ? record.get("OrgUnit") : null,
                                kpiPeriod, orgUnit, currentUser, affectedPairs, affectedUserPairs, userOrgId);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            } else {
                try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
                    Sheet sheet = workbook.getSheetAt(0);
                    Row headerRow = sheet.getRow(0);
                    if (headerRow == null) throw new BusinessException("File Excel trống");

                    int nameIdx = -1, descIdx = -1, weightIdx = -1, targetIdx = -1, minIdx = -1, unitIdx = -1, freqIdx = -1, codeIdx = -1, namePeriodIdx = -1, nameOrgIdx = -1;
                    for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                        String header = headerRow.getCell(i).getStringCellValue().trim();
                        if (header.equalsIgnoreCase("Name")) nameIdx = i;
                        else if (header.equalsIgnoreCase("Description")) descIdx = i;
                        else if (header.equalsIgnoreCase("Weight")) weightIdx = i;
                        else if (header.equalsIgnoreCase("TargetValue")) targetIdx = i;
                        else if (header.equalsIgnoreCase("MinimumValue")) minIdx = i;
                        else if (header.equalsIgnoreCase("Frequency")) freqIdx = i;
                        else if (header.equalsIgnoreCase("EmployeeCode")) codeIdx = i;
                        else if (header.equalsIgnoreCase("Unit")) unitIdx = i;
                        else if (header.equalsIgnoreCase("Period")) namePeriodIdx = i;
                        else if (header.equalsIgnoreCase("OrgUnit")) nameOrgIdx = i;
                    }

                    if (nameIdx == -1 || weightIdx == -1 || targetIdx == -1 || freqIdx == -1 || codeIdx == -1) {
                        throw new BusinessException("Thiếu các cột bắt buộc trong file Excel");
                    }

                    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                        Row row = sheet.getRow(i);
                        if (row == null) continue;
                        totalRows++;
                        try {
                            processKpiRow(
                                getCellValueAsString(row.getCell(nameIdx)),
                                descIdx != -1 ? getCellValueAsString(row.getCell(descIdx)) : null,
                                getCellValueAsString(row.getCell(weightIdx)),
                                getCellValueAsString(row.getCell(targetIdx)),
                                minIdx != -1 ? getCellValueAsString(row.getCell(minIdx)) : null,
                                unitIdx != -1 ? getCellValueAsString(row.getCell(unitIdx)) : null,
                                getCellValueAsString(row.getCell(freqIdx)),
                                getCellValueAsString(row.getCell(codeIdx)),
                                namePeriodIdx != -1 ? getCellValueAsString(row.getCell(namePeriodIdx)) : null,
                                nameOrgIdx != -1 ? getCellValueAsString(row.getCell(nameOrgIdx)) : null,
                                kpiPeriod, orgUnit, currentUser, affectedPairs, affectedUserPairs, userOrgId
                            );
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add("Dòng " + totalRows + ": " + e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException("Lỗi xử lý file: " + e.getMessage());
        }

        if (!errors.isEmpty()) {
            String errorMsg = errors.stream().limit(5).collect(java.util.stream.Collectors.joining("\n"));
            if (errors.size() > 5) {
                errorMsg += "\n... và " + (errors.size() - 5) + " lỗi khác.";
            }
            throw new BusinessException("Lỗi dữ liệu các dòng trong file:\n" + errorMsg);
        }

        // Post-import validation: Check total weight for all modified unit-period pairs
        for (String pair : affectedPairs) {
            String[] ids = pair.split(":");
            UUID uId = UUID.fromString(ids[0]);
            UUID pId = UUID.fromString(ids[1]);
            
            OrgUnit unit = orgUnitRepository.findById(uId).orElse(null);
            
            // SKIP weight validation for Root units (units with no parent)
            if (unit == null || unit.getParent() == null) {
                continue;
            }

            Double totalWeight = kpiCriteriaRepository.sumWeightByOrgUnitIdAndKpiPeriodIdAndStatusIn(
                uId, pId, java.util.Arrays.asList(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED, KpiStatus.EDIT, KpiStatus.EDITED)
            );

            if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
                // Weight is not 100% -> THROW EXCEPTION to rollback the entire transaction
                throw new BusinessException("Lỗi Import: Đơn vị '" + unit.getName() + "' có tổng trọng số là " + 
                          (totalWeight != null ? totalWeight : 0) + "%. Quy tắc bắt buộc phải bằng chính xác 100%. " +
                          "Vui lòng chỉnh sửa lại file Excel và thực hiện Import lại.");
            }
        }

        // Post-import validation: Check total weight for all modified user-period pairs
        for (String pair : affectedUserPairs) {
            String[] ids = pair.split(":");
            UUID uId = UUID.fromString(ids[0]);
            UUID pId = UUID.fromString(ids[1]);
            
            User user = userRepository.findById(uId).orElse(null);
            
            List<KpiStatus> activeStatuses = java.util.Arrays.asList(
                KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED, KpiStatus.EDIT, KpiStatus.EDITED
            );

            Double totalWeight = kpiCriteriaRepository.sumWeightByUserIdAndKpiPeriodIdAndStatusIn(uId, pId, activeStatuses);

            if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
                throw new BusinessException("Lỗi Import: Nhân viên '" + (user != null ? user.getFullName() : uId) + "' có tổng trọng số là " + 
                          (totalWeight != null ? totalWeight : 0) + "%. Quy tắc bắt buộc phải bằng chính xác 100%.");
            }
        }

        return ImportKpiResponse.builder()
                .totalRows(totalRows)
                .successfulImports(successfulImports)
                .errors(errors)
                .build();
    }

    private void processKpiRow(String name, String desc, String weight, String target, String min, String unit, String freq, String empCode, 
                              String periodName, String orgName,
                              com.kpitracking.entity.KpiPeriod defaultPeriod, OrgUnit defaultUnit, User creator, 
                              java.util.Set<String> affectedPairs, java.util.Set<String> affectedUserPairs, UUID organizationId) {
        if (name == null || name.isBlank()) throw new BusinessException("Tên chỉ tiêu là bắt buộc");
        if (weight == null || weight.isBlank()) throw new BusinessException("Trọng số là bắt buộc");
        if (target == null || target.isBlank()) throw new BusinessException("Chỉ tiêu (Target) là bắt buộc");

        // Priority: Use the period name from Excel/Preview first if provided
        com.kpitracking.entity.KpiPeriod finalPeriod = null;
        if (periodName != null && !periodName.isBlank()) {
            String cleanPeriod = periodName.trim().replaceAll("\\s+", " ");
            java.util.Optional<com.kpitracking.entity.KpiPeriod> foundPeriod = java.util.Optional.empty();
            if (organizationId != null) {
                foundPeriod = kpiPeriodRepository.findByNameSmart(cleanPeriod, organizationId);
            }
            finalPeriod = foundPeriod
                    .or(() -> kpiPeriodRepository.findByNameIgnoreCase(cleanPeriod))
                    .orElse(null); // Don't throw yet, try default
        }

        if (finalPeriod == null) {
            finalPeriod = defaultPeriod;
        }
        
        if (finalPeriod == null) {
            throw new BusinessException("Vui lòng chọn đợt KPI hoặc cung cấp tên đợt trong file Excel");
        }

        // Same priority logic for OrgUnit: Row data first, then default
        OrgUnit finalUnit = null;
        if (orgName != null && !orgName.isBlank()) {
            String cleanOrg = orgName.trim().replaceAll("\\s+", " ");
            java.util.Optional<OrgUnit> foundUnit = java.util.Optional.empty();
            if (organizationId != null) {
                foundUnit = orgUnitRepository.findByNameSmart(cleanOrg, organizationId);
            }
            finalUnit = foundUnit
                    .or(() -> orgUnitRepository.findByNameIgnoreCase(cleanOrg))
                    .orElse(null); // Try default if not found by name
        }

        if (finalUnit == null) {
            finalUnit = defaultUnit;
        }

        if (finalUnit == null) {
            throw new BusinessException("Vui lòng chọn đơn vị hoặc cung cấp tên đơn vị trong file Excel");
        }
        
        // Check permission for the final unit
        if (!permissionChecker.hasPermissionInOrgUnit(creator.getId(), "KPI:CREATE", finalUnit.getId())) {
            throw new ForbiddenException("Bạn không có quyền tạo KPI cho đơn vị: " + finalUnit.getName());
        }

        java.util.List<User> assignees = new java.util.ArrayList<>();
        if (empCode != null && !empCode.isBlank()) {
            String[] codes = empCode.split(",");
            for (String code : codes) {
                String trimmedCode = code.trim();
                if (trimmedCode.isEmpty()) continue;
                User user = userRepository.findByEmployeeCode(trimmedCode)
                        .orElseThrow(() -> new BusinessException("Không tìm thấy nhân viên với mã: " + trimmedCode));
                assignees.add(user);
            }
        }
        if (assignees.isEmpty()) throw new BusinessException("Vui lòng cung cấp ít nhất một mã nhân viên để giao chỉ tiêu");

        KpiFrequency frequency;
        try {
            frequency = KpiFrequency.valueOf(freq.toUpperCase());
        } catch (Exception e) {
            throw new BusinessException("Tần suất không hợp lệ: " + freq);
        }

        double weightVal;
        double targetVal;
        try {
            weightVal = Double.parseDouble(weight);
            targetVal = Double.parseDouble(target);
        } catch (NumberFormatException e) {
            throw new BusinessException("Trọng số và Chỉ tiêu phải là định dạng số");
        }

        // Check if user has permission to approve for this unit
        boolean canApprove = permissionChecker.hasPermissionInOrgUnit(creator.getId(), "KPI:APPROVE", finalUnit.getId());
        
        KpiCriteria kpi = KpiCriteria.builder()
                .name(name)
                .description(desc)
                .weight(weightVal)
                .targetValue(targetVal)
                .minimumValue(min != null && !min.isBlank() ? Double.parseDouble(min) : null)
                .unit(unit)
                .frequency(frequency)
                .assignees(assignees)
                .orgUnit(finalUnit)
                .kpiPeriod(finalPeriod)
                .createdBy(creator)
                .status(canApprove ? KpiStatus.APPROVED : KpiStatus.DRAFT)
                .build();
        
        if (kpi.getStatus() == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }

        kpiCriteriaRepository.save(kpi);

        // Track the unit and period
        affectedPairs.add(finalUnit.getId().toString() + ":" + finalPeriod.getId().toString());
        
        // Track each user and period
        for (User assignee : assignees) {
            affectedUserPairs.add(assignee.getId().toString() + ":" + finalPeriod.getId().toString());
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        DataFormatter formatter = new DataFormatter();
        return formatter.formatCellValue(cell).trim();
    }
}
