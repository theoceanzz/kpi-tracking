package com.kpitracking.service;

import com.kpitracking.dto.request.kpi.CreateKpiCriteriaRequest;
import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.UpdateKpiCriteriaRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.ImportKpiResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.OrgUnit;
import com.kpitracking.entity.Organization;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiFrequency;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaRejectedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovalRevertedEvent;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
    private final com.kpitracking.repository.KeyResultRepository keyResultRepository;
    private final OrganizationService organizationService;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "email", email));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        boolean canApprove = permissionChecker.hasPermission(currentUser.getId(), "KPI:APPROVE_OWN");

        KpiStatus initialStatus = canApprove ? KpiStatus.APPROVED : KpiStatus.DRAFT;

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));

        validateDeadlineWithinPeriod(request.getDeadline(), kpiPeriod);

        if (request.getFrequency().ordinal() > kpiPeriod.getPeriodType().ordinal()) {
            throw new BusinessException("Tần suất đánh giá (Tháng/Quý/Năm) phải nhỏ hơn hoặc bằng loại kỳ đánh giá (Đợt).");
        }

        List<UUID> targetOrgUnitIds = new ArrayList<>();
        if (request.getOrgUnitIds() != null && !request.getOrgUnitIds().isEmpty()) {
            targetOrgUnitIds.addAll(request.getOrgUnitIds());
        } else if (request.getOrgUnitId() != null) {
            targetOrgUnitIds.add(request.getOrgUnitId());
        } else {
            List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
            if (!assignments.isEmpty()) {
                targetOrgUnitIds.add(assignments.get(0).getOrgUnit().getId());
            } else {
                throw new BusinessException("Người dùng phải thuộc ít nhất một đơn vị để tạo KPI");
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

        KpiCriteria lastKpi = null;
        for (UUID orgUnitId : targetOrgUnitIds) {
            OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                    .orElseThrow(() -> new ResourceNotFoundException("Đơn vị", "id", orgUnitId));

            // Permission check: only users with KPI:CREATE in the target OrgUnit can create
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnit.getId())) {
                throw new ForbiddenException("Bạn không có quyền tạo chỉ tiêu cho đơn vị " + orgUnit.getName());
            }

            validateWaterfallAssignment(currentUser, orgUnit, assignees);

            KpiCriteria kpi = buildKpiEntity(request, orgUnit, assignees, currentUser, initialStatus, kpiPeriod);
            kpi = kpiCriteriaRepository.save(kpi);

            if (initialStatus == KpiStatus.APPROVED) {
                eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
            }
            lastKpi = kpi;
        }

        return lastKpi != null ? kpiCriteriaMapper.toResponse(lastKpi) : null;
    }

    private void validateDeadlineWithinPeriod(Instant deadline, com.kpitracking.entity.KpiPeriod period) {
        if (deadline == null) return;
        if (period.getStartDate() != null && deadline.isBefore(period.getStartDate())) {
            throw new BusinessException("Hạn chót (deadline) không được trước ngày bắt đầu của kỳ đánh giá.");
        }
        if (period.getEndDate() != null && deadline.isAfter(period.getEndDate())) {
            throw new BusinessException("Hạn chót (deadline) không được sau ngày kết thúc của kỳ đánh giá.");
        }
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
                .isReverseKpi(Boolean.TRUE.equals(request.getIsReverseKpi()))
                .isBonusKpi(Boolean.TRUE.equals(request.getIsBonusKpi()))
                .unit(request.getUnit())
                .deadline(request.getDeadline())
                .frequency(request.getFrequency())
                .status(status)
                .createdBy(creator)
                .kpiPeriod(kpiPeriod)
                .build();

        if (request.getParentId() != null) {
            KpiCriteria parent = kpiCriteriaRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("KPI Cha", "id", request.getParentId()));

            com.kpitracking.enums.KpiParentRelationType relationType = request.getParentRelationType() != null
                    ? request.getParentRelationType()
                    : com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION;

            if (relationType == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION) {
                boolean isParentOwner = parent.getCreatedBy() != null && parent.getCreatedBy().getId().equals(creator.getId());
                boolean isParentAssignee = parent.getAssignees() != null && parent.getAssignees().stream().anyMatch(a -> a.getId().equals(creator.getId()));
                if (!isParentOwner && !isParentAssignee && !permissionChecker.isGlobalAdmin(creator.getId())) {
                    throw new ForbiddenException("Bạn chỉ có thể chia nhỏ KPI do chính mình tạo hoặc được giao thực hiện");
                }

                double siblingWeight = parent.getChildren() != null ? parent.getChildren().stream()
                        .filter(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)
                        .mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0)
                        .sum() : 0.0;
                double newWeight = request.getWeight() != null ? request.getWeight() : 0.0;
                double parentWeight = parent.getWeight() != null ? parent.getWeight() : 0.0;

                if (siblingWeight + newWeight > parentWeight + 0.001) {
                    throw new BusinessException("Tổng trọng số các KPI con (" + (siblingWeight + newWeight) +
                            "%) vượt quá trọng số KPI cha (" + parentWeight + "%)");
                }
            }

            kpi.setParent(parent);
            kpi.setParentRelationType(relationType);
        }

        if (request.getKeyResultId() != null) {
            com.kpitracking.entity.KeyResult kr = keyResultRepository.findById(request.getKeyResultId())
                    .orElseThrow(() -> new ResourceNotFoundException("Key Result", "id", request.getKeyResultId()));
            
            // Validation: KPI OrgUnit must match one of the KeyResult Objective's OrgUnits
            if (orgUnit != null && kr.getObjective() != null && !kr.getObjective().getOrgUnits().isEmpty()) {
                boolean matching = kr.getObjective().getOrgUnits().stream()
                        .anyMatch(u -> u.getId().equals(orgUnit.getId()));
                if (!matching) {
                    String unitNames = kr.getObjective().getOrgUnits().stream()
                            .map(com.kpitracking.entity.OrgUnit::getName)
                            .collect(java.util.stream.Collectors.joining(", "));
                    throw new BusinessException("Chỉ tiêu KPI phải thuộc cùng đơn vị với Kết quả then chốt (OKR) được liên kết. " +
                            "(Đơn vị KPI: " + orgUnit.getName() + ", Đơn vị OKR: " + unitNames + ")");
                }
            }
            kpi.setKeyResult(kr);
        }

        if (status == KpiStatus.APPROVED) {
            kpi.setApprovedBy(creator);
            kpi.setApprovedAt(Instant.now());
        }
        return kpi;
    }

    public double calculateActualValue(KpiCriteria kpi) {
        // If Waterfall is enabled and KPI has children, sum their values
        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        if (org != null && org.getEnableWaterfall()) {
            List<KpiCriteria> children = kpiCriteriaRepository.findByParentId(kpi.getId());
            if (!children.isEmpty()) {
                return children.stream()
                        .mapToDouble(this::calculateActualValue)
                        .sum();
            }
        }

        // Base case: No children, sum its own approved submissions
        if (kpi.getSubmissions() == null) return 0.0;
        return kpi.getSubmissions().stream()
                .filter(s -> s.getStatus() == com.kpitracking.enums.SubmissionStatus.APPROVED && s.getDeletedAt() == null)
                .mapToDouble(s -> s.getActualValue() != null ? s.getActualValue() : 0.0)
                .sum();
    }

    @Transactional(readOnly = true)
    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId, UUID createdById, UUID assigneeId, UUID kpiPeriodId, String keyword, Instant startDate, Instant endDate, String sortBy, String sortDir, UUID objectiveId, UUID keyResultId, boolean approvalMode, String kpiNature, Boolean isBonusKpi, Boolean isReverseKpi) {
        User currentUser = getCurrentUser();
        UUID organizationId = getCurrentUserOrganizationId(currentUser);

        // User's own units: colleagues' KPIs are visible only when APPROVED
        List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(currentUser.getId());
        List<UUID> sameUnitIds = assignments.stream()
                .map(a -> a.getOrgUnit().getId())
                .distinct()
                .collect(java.util.stream.Collectors.toList());

        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        String orgUnitPath = null;
        if (orgUnitId != null) {
            orgUnitPath = orgUnitRepository.findById(orgUnitId)
                    .map(com.kpitracking.entity.OrgUnit::getPath)
                    .map(path -> path + "%")
                    .orElse(null);
        }

        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findAllWithFilters(
                organizationId,
                currentUser.getId(),
                sameUnitIds,
                approvalMode,
                createdById,
                assigneeId,
                orgUnitPath,
                status,
                kpiPeriodId,
                keyword,
                startDate,
                endDate,
                objectiveId,
                keyResultId,
                kpiNature,
                isBonusKpi,
                isReverseKpi,
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
        
        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = kpi.getAssignees().stream().anyMatch(a -> a.getId().equals(currentUser.getId()));
        boolean isSameUnit = !userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), kpi.getOrgUnit().getId()).isEmpty();

        boolean canView = isCreator || isAssignee || (isSameUnit && kpi.getStatus() == KpiStatus.APPROVED);
        if (!canView) {
            throw new ForbiddenException("Bạn không có quyền xem KPI này");
        }

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional(readOnly = true)
    public List<KpiCriteriaResponse> getChildren(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());
        boolean isAssignee = kpi.getAssignees().stream().anyMatch(a -> a.getId().equals(currentUser.getId()));
        boolean isSameUnit = !userRoleOrgUnitRepository.findByUserIdAndOrgUnitId(currentUser.getId(), kpi.getOrgUnit().getId()).isEmpty();

        boolean canView = isCreator || isAssignee || (isSameUnit && kpi.getStatus() == KpiStatus.APPROVED);
        if (!canView) {
            throw new ForbiddenException("Bạn không có quyền xem KPI này");
        }

        return kpiCriteriaRepository.findByParentId(kpiId).stream()
                .map(kpiCriteriaMapper::toResponse)
                .toList();
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

        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        boolean enableWaterfall = org != null && org.getEnableWaterfall();
        boolean canApprove = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE_ADJUSTMENT", kpi.getOrgUnit().getId());

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED && kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            if (enableWaterfall) {
                // Waterfall ON: Only allow managers to update approved KPIs (for delegation)
                if (!canApprove) {
                    throw new BusinessException("Chỉ cấp quản lý mới có quyền điều chỉnh KPI đã duyệt trong mô hình Thác nước.");
                }
            } else {
                // Waterfall OFF: Strict block - no one can update approved KPIs
                throw new BusinessException("Chỉ có thể cập nhật KPI ở trạng thái NHÁP, CHỜ PHÊ DUYỆT hoặc BỊ TỪ CHỐI.");
            }
        }

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getMinimumValue() != null) kpi.setMinimumValue(request.getMinimumValue());
        if (request.getIsReverseKpi() != null) kpi.setIsReverseKpi(request.getIsReverseKpi());
        if (request.getIsBonusKpi() != null) kpi.setIsBonusKpi(request.getIsBonusKpi());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());
        if (request.getDeadline() != null) {
            validateDeadlineWithinPeriod(request.getDeadline(), kpi.getKpiPeriod());
            kpi.setDeadline(request.getDeadline());
        }

        // When pending approval, only basic fields above are editable
        if (kpi.getStatus() == KpiStatus.PENDING_APPROVAL) {
            kpi = kpiCriteriaRepository.save(kpi);
            return kpiCriteriaMapper.toResponse(kpi);
        }

        if (request.getKpiPeriodId() != null) {
            com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                    .orElseThrow(() -> new ResourceNotFoundException("Kỳ đánh giá (Đợt)", "id", request.getKpiPeriodId()));
            kpi.setKpiPeriod(kpiPeriod);
            if (request.getDeadline() != null) {
                validateDeadlineWithinPeriod(request.getDeadline(), kpiPeriod);
            }
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

        if (request.getAssignedToIds() != null) {
            java.util.List<UUID> assigneeIds = new java.util.ArrayList<>(request.getAssignedToIds());
            
            if (enableWaterfall && canApprove) {
                // WATERFALL LOGIC: Create child KPIs for each assignee instead of just adding to the same record
                // 1. Remove the delegated staff from the parent's assignees (keep only the leader if they were there)
                java.util.List<User> parentAssignees = new java.util.ArrayList<>();
                if (assigneeIds.contains(currentUser.getId())) {
                    parentAssignees.add(currentUser);
                }
                kpi.setAssignees(parentAssignees);

                // 2. Create child KPIs for staff (excluding the leader themselves)
                int staffCount = 0;
                for (UUID id : assigneeIds) {
                    if (!id.equals(currentUser.getId())) {
                        staffCount++;
                    }
                }

                Double dividedTarget = (kpi.getTargetValue() != null && staffCount > 0) ? kpi.getTargetValue() / staffCount : kpi.getTargetValue();
                Double dividedMinimum = (kpi.getMinimumValue() != null && staffCount > 0) ? kpi.getMinimumValue() / staffCount : kpi.getMinimumValue();

                for (UUID id : assigneeIds) {
                    if (id.equals(currentUser.getId())) continue;

                    User staff = userRepository.findById(id)
                            .orElseThrow(() -> new ResourceNotFoundException("Nhân viên", "id", id));

                    // Check if a child KPI already exists for this staff to avoid duplicates
                    boolean exists = kpiCriteriaRepository.existsByParentAndAssigneesContains(kpi, staff);
                    if (!exists) {
                        KpiCriteria childKpi = KpiCriteria.builder()
                                .name(kpi.getName())
                                .description(kpi.getDescription())
                                .weight(kpi.getWeight()) // Keep parent weight
                                .targetValue(dividedTarget) // Divided evenly
                                .minimumValue(dividedMinimum) // Divided evenly
                                .isReverseKpi(Boolean.TRUE.equals(kpi.getIsReverseKpi()))
                                .isBonusKpi(Boolean.TRUE.equals(kpi.getIsBonusKpi()))
                                .unit(kpi.getUnit())
                                .frequency(kpi.getFrequency())
                                .status(KpiStatus.APPROVED) // Auto approve cascaded KPIs
                                .createdBy(currentUser)
                                .kpiPeriod(kpi.getKpiPeriod())
                                .orgUnit(kpi.getOrgUnit())
                                .parent(kpi)
                                .parentRelationType(com.kpitracking.enums.KpiParentRelationType.DELEGATION)
                                .assignees(java.util.List.of(staff))
                                .keyResult(kpi.getKeyResult())
                                .build();
                        kpiCriteriaRepository.save(childKpi);
                    }
                }
            } else {
                // STANDARD LOGIC: Just update the assignees of the same record
                java.util.List<User> assignees = new java.util.ArrayList<>();
                for (UUID id : assigneeIds) {
                    assignees.add(userRepository.findById(id)
                            .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", id)));
                }
                kpi.setAssignees(assignees);
                validateWaterfallAssignment(currentUser, kpi.getOrgUnit(), assignees);
            }
        } else if (request.getAssignedToId() != null) {
            // Legacy single ID handling
            User assignee = userRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Người dùng", "id", request.getAssignedToId()));
            kpi.setAssignees(java.util.List.of(assignee));
        }

        if (request.getKeyResultId() != null) {
            com.kpitracking.entity.KeyResult kr = keyResultRepository.findById(request.getKeyResultId())
                    .orElseThrow(() -> new ResourceNotFoundException("Key Result", "id", request.getKeyResultId()));
            kpi.setKeyResult(kr);
        } else if (request.getKeyResultId() == null && request.getName() != null) {
            // Keep existing keyResult if not provided in the update
        }

        if (request.getParentId() != null) {
            KpiCriteria parent = kpiCriteriaRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException("KPI Cha", "id", request.getParentId()));
            kpi.setParent(parent);
            if (request.getParentRelationType() != null) {
                kpi.setParentRelationType(request.getParentRelationType());
            }
        }

        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }
    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        List<KpiCriteriaResponse> results = bulkSubmitForApproval(java.util.List.of(kpiId));
        if (results.isEmpty()) {
            throw new BusinessException("Không thể gửi duyệt chỉ tiêu này. Vui lòng kiểm tra quyền sở hữu hoặc trạng thái của chỉ tiêu.");
        }
        return results.get(0);
    }
    
    @Transactional
    public List<KpiCriteriaResponse> bulkSubmitForApproval(List<UUID> kpiIds) {
        User currentUser = getCurrentUser();
        List<KpiCriteriaResponse> results = new ArrayList<>();
        
        if (kpiIds == null || kpiIds.isEmpty()) return results;

        // Check if any of the KPIs exist and find orgUnit/period for weight validation
        KpiCriteria firstKpi = kpiCriteriaRepository.findById(kpiIds.get(0))
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiIds.get(0)));

        // Weight validation (same as single submit)
        java.util.List<KpiStatus> statuses = java.util.Arrays.asList(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED, KpiStatus.EDIT, KpiStatus.EDITED);
        Double totalWeight = calculateTotalWeightByOrgUnit(firstKpi.getOrgUnit().getId(), firstKpi.getKpiPeriod().getId(), statuses);

        if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
            throw new BusinessException("Tổng trọng số của đơn vị theo phân bổ nhân sự (cao nhất) phải bằng chính xác 100% trước khi gửi duyệt. Hiện tại: " + (totalWeight != null ? totalWeight : 0) + "%");
        }

        for (UUID kpiId : kpiIds) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId).orElse(null);
            if (kpi == null) continue;

            if (!kpi.getCreatedBy().getId().equals(currentUser.getId())) {
                 // Skip or throw? Usually better to skip in bulk or throw if critical. 
                 // Here we skip to avoid breaking the whole batch if one is invalid.
                 continue;
            }

            if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED) {
                continue;
            }

            if (kpi.getParent() != null && kpi.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION) {
                KpiCriteria parent = kpi.getParent();
                double siblingWeight = parent.getChildren() != null ? parent.getChildren().stream()
                        .filter(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)
                        .mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0)
                        .sum() : 0.0;
                double parentWeight = parent.getWeight() != null ? parent.getWeight() : 0.0;
                if (Math.abs(siblingWeight - parentWeight) > 0.001) {
                    throw new BusinessException("Tổng trọng số các KPI con của '" + parent.getName() + "' (" + siblingWeight +
                            "%) phải bằng chính xác trọng số KPI cha (" + parentWeight + "%) trước khi gửi duyệt");
                }
            }

            kpi.setStatus(KpiStatus.PENDING_APPROVAL);
            kpi.setSubmittedAt(Instant.now());
            kpi.setRejectReason(null);
            kpi = kpiCriteriaRepository.save(kpi);
            results.add(kpiCriteriaMapper.toResponse(kpi));
        }

        return results;
    }

    @Transactional
    public KpiCriteriaResponse approveKpi(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE_CRITERIA", kpi.getOrgUnit().getId())) {
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
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE_CRITERIA", kpi.getOrgUnit().getId())) {
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

        eventPublisher.publishEvent(new KpiCriteriaRejectedEvent(this, kpi));

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public KpiCriteriaResponse revertApproval(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException("Chỉ tiêu KPI", "id", kpiId));

        if (!permissionChecker.isGlobalAdmin(currentUser.getId())) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:REVERT_APPROVAL", kpi.getOrgUnit().getId())) {
                throw new ForbiddenException("Bạn không có quyền hoàn duyệt chỉ tiêu KPI cho đơn vị này");
            }

            // Same hierarchical rule as approveKpi: reviewer must be superior to the creator
            User creator = kpi.getCreatedBy();
            int creatorLevel = permissionChecker.getMinLevelInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());
            int creatorRank = permissionChecker.getMinRankInOrgUnit(creator.getId(), kpi.getOrgUnit().getId());

            int reviewerLevel = permissionChecker.getMinLevelInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());
            int reviewerRank = permissionChecker.getMinRankInOrgUnit(currentUser.getId(), kpi.getOrgUnit().getId());

            boolean isSuperior = reviewerLevel < creatorLevel || (reviewerLevel == creatorLevel && reviewerRank < creatorRank);

            if (!isSuperior) {
                if (reviewerLevel > creatorLevel) {
                    throw new ForbiddenException("Bạn không thể hoàn duyệt chỉ tiêu của người có cấp bậc cao hơn bạn");
                } else if (reviewerLevel == creatorLevel && reviewerRank == creatorRank) {
                    throw new ForbiddenException("Bạn không thể hoàn duyệt chỉ tiêu của người có cùng chức vụ");
                } else {
                    throw new ForbiddenException("Bạn không đủ thẩm quyền để hoàn duyệt chỉ tiêu này");
                }
            }
        }

        if (kpi.getStatus() != KpiStatus.APPROVED) {
            throw new BusinessException("Chỉ có thể hoàn duyệt KPI đang ở trạng thái ĐÃ DUYỆT");
        }

        kpi.setStatus(KpiStatus.PENDING_APPROVAL);
        kpi.setApprovedBy(null);
        kpi.setApprovedAt(null);
        kpi = kpiCriteriaRepository.save(kpi);

        eventPublisher.publishEvent(new KpiCriteriaApprovalRevertedEvent(this, kpi, currentUser));

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
    public PageResponse<KpiCriteriaResponse> getMyKpi(int page, int size, UUID kpiPeriodId, Instant startDate, Instant endDate, String sortBy, String sortDir, UUID objectiveId, UUID keyResultId) {
        User currentUser = getCurrentUser();
        UUID organizationId = getCurrentUserOrganizationId(currentUser);
        Sort sort = Sort.by(sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy != null ? sortBy : "createdAt");
        Pageable pageable = PageRequest.of(page, size, sort);

        java.util.List<KpiStatus> activeStatuses = java.util.Arrays.asList(KpiStatus.APPROVED, KpiStatus.EDITED, KpiStatus.EDIT);
        Page<KpiCriteria> kpiPage = kpiCriteriaRepository.findMyWithFilters(
                organizationId, currentUser.getId(), null, activeStatuses, kpiPeriodId, startDate, endDate, objectiveId, keyResultId, pageable);

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

    private boolean hasDecompositionChildren(KpiCriteria kpi) {
        return kpi.getChildren() != null && kpi.getChildren().stream()
                .anyMatch(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION);
    }

    @Transactional(readOnly = true)
    public Double calculateTotalWeightByOrgUnit(UUID orgUnitId, UUID kpiPeriodId, List<KpiStatus> statuses) {
        List<KpiCriteria> kpis = kpiCriteriaRepository.findByOrgUnitIdAndKpiPeriodIdAndStatusIn(orgUnitId, kpiPeriodId, statuses);
        
        Double unassignedWeight = 0.0;
        Map<UUID, Double> userWeights = new HashMap<>();
        
        for (KpiCriteria kpi : kpis) {
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue; // Bonus KPIs don't count toward the 100% requirement
            if (hasDecompositionChildren(kpi)) continue; // Parent is just a grouping label; its children carry the real weight

            Double weight = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
            if (kpi.getAssignees() == null || kpi.getAssignees().isEmpty()) {
                unassignedWeight += weight;
            } else {
                for (User assignee : kpi.getAssignees()) {
                    userWeights.merge(assignee.getId(), weight, Double::sum);
                }
            }
        }
        
        if (userWeights.isEmpty()) {
            return unassignedWeight;
        }
        
        Double maxUserWeight = userWeights.values().stream().max(Double::compare).orElse(0.0);
        return unassignedWeight + maxUserWeight;
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
            // When orgUnitId is also provided, scope the sum to that specific unit
            if (orgUnitId != null) {
                return kpiCriteriaRepository.sumWeightByUserIdAndOrgUnitIdAndKpiPeriodIdAndStatusIn(userId, orgUnitId, kpiPeriodId, statuses);
            }
            return kpiCriteriaRepository.sumWeightByUserIdAndKpiPeriodIdAndStatusIn(userId, kpiPeriodId, statuses);
        }

        if (orgUnitId != null) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", orgUnitId)) {
                throw new ForbiddenException("Bạn không có quyền xem thông tin trọng số của đơn vị này");
            }

            return calculateTotalWeightByOrgUnit(orgUnitId, kpiPeriodId, statuses);
        }
        
        return 0.0;
    }

    @Transactional
    public ImportKpiResponse importKpis(MultipartFile file, UUID kpiPeriodId, UUID orgUnitId) {
        User currentUser = getCurrentUser();
        // Track modified user-period-orgunit triplets to validate weight after import
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
                                record.isMapped("KeyResultCode") ? record.get("KeyResultCode") : null,
                                record.isMapped("IsReverseKpi") ? record.get("IsReverseKpi") : null,
                                record.isMapped("IsBonusKpi") ? record.get("IsBonusKpi") : null,
                                record.isMapped("Deadline") ? record.get("Deadline") : null,
                                kpiPeriod, orgUnit, currentUser, affectedUserPairs, userOrgId);
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

                    int nameIdx = -1, descIdx = -1, weightIdx = -1, targetIdx = -1, minIdx = -1, unitIdx = -1, freqIdx = -1, codeIdx = -1, namePeriodIdx = -1, nameOrgIdx = -1, krCodeIdx = -1, isReverseKpiIdx = -1, isBonusKpiIdx = -1, deadlineIdx = -1;
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
                        else if (header.equalsIgnoreCase("KeyResultCode")) krCodeIdx = i;
                        else if (header.equalsIgnoreCase("IsReverseKpi")) isReverseKpiIdx = i;
                        else if (header.equalsIgnoreCase("IsBonusKpi")) isBonusKpiIdx = i;
                        else if (header.equalsIgnoreCase("Deadline")) deadlineIdx = i;
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
                                krCodeIdx != -1 ? getCellValueAsString(row.getCell(krCodeIdx)) : null,
                                isReverseKpiIdx != -1 ? getCellValueAsString(row.getCell(isReverseKpiIdx)) : null,
                                isBonusKpiIdx != -1 ? getCellValueAsString(row.getCell(isBonusKpiIdx)) : null,
                                deadlineIdx != -1 ? getCellValueAsString(row.getCell(deadlineIdx)) : null,
                                kpiPeriod, orgUnit, currentUser, affectedUserPairs, userOrgId
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

        // Post-import validation: Check total weight for all modified user-period-orgunit triplets
        for (String pair : affectedUserPairs) {
            String[] ids = pair.split(":");
            UUID uId = UUID.fromString(ids[0]);
            UUID pId = UUID.fromString(ids[1]);
            UUID ouId = UUID.fromString(ids[2]);

            User user = userRepository.findById(uId).orElse(null);
            OrgUnit unit = orgUnitRepository.findById(ouId).orElse(null);

            // Skip root units (no parent) — same rule as org-level validation
            if (unit == null || unit.getParent() == null) {
                continue;
            }

            com.kpitracking.entity.KpiPeriod period = kpiPeriodRepository.findById(pId).orElse(null);
            String periodName = period != null ? period.getName() : pId.toString();

            List<KpiStatus> activeStatuses = java.util.Arrays.asList(
                KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL, KpiStatus.APPROVED, KpiStatus.REJECTED, KpiStatus.EDIT, KpiStatus.EDITED
            );

            Double totalWeight = kpiCriteriaRepository.sumWeightByUserIdAndOrgUnitIdAndKpiPeriodIdAndStatusIn(uId, ouId, pId, activeStatuses);

            if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
                throw new BusinessException("Lỗi Import: Nhân viên '" + (user != null ? user.getFullName() : uId) +
                          "' trong đơn vị '" + (unit != null ? unit.getName() : ouId) +
                          "' trong đợt '" + periodName + "' có tổng trọng số là " +
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
                              String periodName, String orgName, String krCode, String isReverseKpiStr, String isBonusKpiStr, String deadlineStr,
                              com.kpitracking.entity.KpiPeriod defaultPeriod, OrgUnit defaultUnit, User creator,
                              java.util.Set<String> affectedUserPairs, UUID organizationId) {
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

        Instant deadlineVal = parseImportDeadline(deadlineStr);
        validateDeadlineWithinPeriod(deadlineVal, finalPeriod);

        // Resolve org units — support comma-separated values e.g. "MK1, MK2"
        java.util.List<OrgUnit> finalUnits = new java.util.ArrayList<>();
        if (orgName != null && !orgName.isBlank()) {
            String[] orgTokens = orgName.split(",");
            for (String token : orgTokens) {
                String cleanOrg = token.trim().replaceAll("\\s+", " ");
                if (cleanOrg.isEmpty()) continue;
                java.util.Optional<OrgUnit> foundUnit = java.util.Optional.empty();
                if (organizationId != null) {
                    foundUnit = orgUnitRepository.findByNameSmart(cleanOrg, organizationId);
                }
                if (!foundUnit.isPresent() && organizationId != null) {
                    foundUnit = orgUnitRepository.findByCodeSmart(cleanOrg, organizationId);
                }
                OrgUnit resolved = foundUnit
                        .or(() -> orgUnitRepository.findByNameIgnoreCase(cleanOrg))
                        .orElse(null);
                if (resolved != null) {
                    finalUnits.add(resolved);
                }
            }
        }

        if (finalUnits.isEmpty()) {
            if (defaultUnit != null) {
                finalUnits.add(defaultUnit);
            } else {
                throw new BusinessException("Vui lòng chọn đơn vị hoặc cung cấp tên đơn vị trong file Excel");
            }
        }

        // Resolve assignees (shared across all units)
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
            throw new BusinessException("Tần suất '" + freq + "' không hợp lệ.");
        }

        // Validate frequency compatibility with period
        if (finalPeriod.getPeriodType() != null) {
            if (frequency.ordinal() > finalPeriod.getPeriodType().ordinal()) {
                throw new BusinessException("Tần suất '" + freq + "' không phù hợp với loại đợt '" + finalPeriod.getPeriodType() + "'. Tần suất của chỉ tiêu không được lớn hơn loại đợt của kỳ KPI.");
            }
        }

        double weightVal;
        double targetVal;
        try {
            weightVal = Double.parseDouble(weight);
            targetVal = Double.parseDouble(target);
        } catch (NumberFormatException e) {
            throw new BusinessException("Trọng số và Chỉ tiêu phải là định dạng số");
        }

        // Create one KpiCriteria per resolved org unit
        for (OrgUnit finalUnit : finalUnits) {
            if (!permissionChecker.hasPermissionInOrgUnit(creator.getId(), "KPI:CREATE", finalUnit.getId())) {
                throw new ForbiddenException("Bạn không có quyền tạo KPI cho đơn vị: " + finalUnit.getName());
            }

            validateWaterfallAssignment(creator, finalUnit, assignees);

            boolean canApprove = permissionChecker.hasPermission(creator.getId(), "KPI:APPROVE_OWN");

            KpiCriteria kpi = KpiCriteria.builder()
                    .name(name)
                    .description(desc)
                    .weight(weightVal)
                    .targetValue(targetVal)
                    .minimumValue(min != null && !min.isBlank() ? Double.parseDouble(min) : null)
                    .isReverseKpi(parseBoolean(isReverseKpiStr))
                    .isBonusKpi(parseBoolean(isBonusKpiStr))
                    .deadline(deadlineVal)
                    .unit(unit)
                    .frequency(frequency)
                    .assignees(assignees)
                    .orgUnit(finalUnit)
                    .kpiPeriod(finalPeriod)
                    .createdBy(creator)
                    .status(canApprove ? KpiStatus.APPROVED : KpiStatus.DRAFT)
                    .build();

            if (krCode != null && !krCode.isBlank()) {
                java.util.Optional<com.kpitracking.entity.KeyResult> krOpt = keyResultRepository.findByCodeSmart(krCode.trim(), organizationId);
                if (krOpt.isPresent()) {
                    com.kpitracking.entity.KeyResult kr = krOpt.get();
                    if (kr.getObjective() != null && !kr.getObjective().getOrgUnits().isEmpty()) {
                        boolean matching = kr.getObjective().getOrgUnits().stream()
                                .anyMatch(u -> u.getId().equals(finalUnit.getId()));
                        if (!matching) {
                            String unitNames = kr.getObjective().getOrgUnits().stream()
                                    .map(com.kpitracking.entity.OrgUnit::getName)
                                    .collect(java.util.stream.Collectors.joining(", "));
                            throw new BusinessException("Lỗi liên kết OKR: Chỉ tiêu KPI ('" + finalUnit.getName() +
                                    "') không cùng đơn vị với Kết quả then chốt ('" + unitNames + "')");
                        }
                    }
                    kpi.setKeyResult(kr);
                }
            }

            if (kpi.getStatus() == KpiStatus.APPROVED) {
                kpi.setApprovedBy(creator);
                kpi.setApprovedAt(Instant.now());
            }

            kpiCriteriaRepository.save(kpi);

            for (User assignee : assignees) {
                affectedUserPairs.add(assignee.getId().toString() + ":" + finalPeriod.getId().toString() + ":" + finalUnit.getId().toString());
            }
        }
    }

    private void validateWaterfallAssignment(User requester, OrgUnit orgUnit, List<User> assignees) {
        Organization org = orgUnit.getOrgHierarchyLevel().getOrganization();
        if (org == null || !Boolean.TRUE.equals(org.getEnableWaterfall())) {
            return;
        }

        // Check if requester is a leader of the org unit (rank 0)
        boolean isRequesterLeader = userRoleOrgUnitRepository.findByUserId(requester.getId()).stream()
                .filter(a -> a.getOrgUnit().getId().equals(orgUnit.getId()))
                .anyMatch(a -> a.getRole().getRank() != null && a.getRole().getRank() == 0);

        // If requester is NOT a leader of THIS unit, they can ONLY assign to leaders of this unit
        if (!isRequesterLeader) {
            for (User assignee : assignees) {
                boolean isAssigneeLeader = userRoleOrgUnitRepository.findByUserId(assignee.getId()).stream()
                        .filter(a -> a.getOrgUnit().getId().equals(orgUnit.getId()))
                        .anyMatch(a -> a.getRole().getRank() != null && a.getRole().getRank() == 0);
                
                if (!isAssigneeLeader) {
                    throw new BusinessException("Trong chế độ Thác nước, chỉ có thể giao chỉ tiêu cho Lãnh đạo đơn vị (rank 0). " +
                            "Nhân viên '" + assignee.getFullName() + "' không phải là lãnh đạo của đơn vị " + orgUnit.getName());
                }
            }
        }
    }

    private String getCellValueAsString(Cell cell) {
        if (cell == null) return null;
        DataFormatter formatter = new DataFormatter();
        return formatter.formatCellValue(cell).trim();
    }

    private boolean parseBoolean(String value) {
        if (value == null || value.isBlank()) return false;
        String v = value.trim().toLowerCase();
        return v.equals("true") || v.equals("1") || v.equals("yes") || v.equals("x") || v.equals("có");
    }

    private Instant parseImportDeadline(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();

        // Accepts "dd/MM/yyyy HH:mm" or "dd/MM/yyyy" (defaults to end-of-day 23:59)
        try {
            String datePart = value.length() > 10 ? value.substring(0, 10) : value;
            java.time.LocalDate date = java.time.LocalDate.parse(datePart, java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            java.time.LocalTime time = value.length() > 10
                    ? java.time.LocalTime.parse(value.substring(11).trim(), java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
                    : java.time.LocalTime.of(23, 59);
            return java.time.LocalDateTime.of(date, time).atZone(java.time.ZoneId.systemDefault()).toInstant();
        } catch (Exception ignored) {
            // try ISO-8601 fallback below
        }

        try {
            return Instant.parse(value);
        } catch (Exception ignored) {
            // fall through to error
        }

        throw new BusinessException("Deadline '" + raw + "' không đúng định dạng. Vui lòng dùng dd/MM/yyyy hoặc dd/MM/yyyy HH:mm.");
    }
}
