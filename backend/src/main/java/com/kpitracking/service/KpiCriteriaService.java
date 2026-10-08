package com.kpitracking.service;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.LocalizedText;
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
import com.kpitracking.event.KpiEvents.KpiCriteriaSubmittedForApprovalEvent;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
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
    private final com.kpitracking.repository.BscPerspectiveRepository bscPerspectiveRepository;
    private final com.kpitracking.repository.BscScorecardRepository bscScorecardRepository;
    private final com.kpitracking.repository.BscScorecardPerspectiveRepository bscScorecardPerspectiveRepository;
    private final KpiAchievementCalculator achievementCalculator;
    private final OrganizationService organizationService;
    private final BscScoringService bscScoringService;
    private final com.kpitracking.workflow.KpiWorkflowConfigService workflowConfigService;
    private final com.kpitracking.workflow.engine.WorkflowEngine workflowEngine;
    private final com.kpitracking.workflow.guard.HierarchyAuthorityGuard hierarchyGuard;
    /** Chặn mọi thao tác ghi vào KPI thuộc kỳ đã khoá (xem CycleStatusGuard). */
    private final com.kpitracking.service.kpi.CycleStatusGuard cycleStatusGuard;
    /** Chuỗi duyệt theo phân cấp (approverMode = CHAIN). */
    private final com.kpitracking.service.kpi.approval.KpiApprovalChainService approvalChain;
    private final com.kpitracking.service.kpi.approval.KpiApprovalViewService approvalView;
    private final com.kpitracking.service.kpi.KpiAccessPolicy kpiAccessPolicy;
    private final com.kpitracking.service.kpi.KpiCollabEnricher collabEnricher;
    private final com.kpitracking.service.kpi.KpiCollabHooks collabHooks;

    private static final List<KpiStatus> WEIGHT_COUNTED_STATUSES = java.util.Arrays.asList(
            KpiStatus.DRAFT,
            KpiStatus.PENDING_APPROVAL,
            KpiStatus.APPROVED,
            KpiStatus.REJECTED,
            KpiStatus.EDIT,
            KpiStatus.EDITED
    );

    /**
     * Trạng thái mà chỉ tiêu đã "vào luồng duyệt" — đã gửi đi hoặc đã được duyệt. Đây là phần
     * bên ngoài lô gửi duyệt được phép tính vào 100%; phần còn lại (DRAFT, REJECTED) nếu không nằm
     * trong lô thì chưa chắc bao giờ được gửi, nên không được mượn trọng số của chúng để qua chốt.
     */
    private static final java.util.Set<KpiStatus> IN_APPROVAL_PIPELINE_STATUSES = java.util.EnumSet.of(
            KpiStatus.PENDING_APPROVAL,
            KpiStatus.APPROVED,
            KpiStatus.EDIT,
            KpiStatus.EDITED
    );

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    private UUID getCurrentUserOrganizationId(User user) {
        List<UserRoleOrgUnit> roles = userRoleOrgUnitRepository.findByUserId(user.getId());
        if (roles.isEmpty()) return null;
        return roles.get(0).getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private UUID organizationIdOf(KpiCriteria kpi) {
        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        return org == null ? null : org.getId();
    }

    /**
     * Chạy một phép chuyển trạng thái của chỉ tiêu qua {@code WorkflowEngine}.
     *
     * <p>Ba phương thức duyệt / từ chối / hoàn duyệt trước đây mỗi cái tự viết lại cùng một trình
     * tự: kiểm quyền trong đơn vị, so cấp bậc với người tạo, kiểm trạng thái, rồi mới đổi. Khối so
     * cấp bậc bị chép nguyên văn ba lần chỉ khác động từ trong thông báo. Giờ trình tự đó nằm ở
     * engine và luật cấp bậc nằm ở {@code HierarchyAuthorityGuard}, nên ở đây chỉ còn phần thật sự
     * riêng của từng hành động.
     */
    private KpiStatus resolveCriteriaTransition(
            KpiCriteria kpi, User actor,
            com.kpitracking.workflow.WorkflowAction action,
            String permissionCode, String verb, ErrorCode statusRejectionCode,
            List<com.kpitracking.workflow.guard.TransitionGuard> invariants) {

        return resolveCriteriaTransition(kpi, actor, action, statusRejectionCode,
                List.of(hierarchyGuard.requiring(permissionCode, verb, "noun.kpi")),
                invariants);
    }

    /**
     * Bản cho phép tự chọn chốt chặn thẩm quyền.
     *
     * <p>Cần thiết vì không phải hành động nào cũng là cấp trên xét cấp dưới. Gửi duyệt là việc TỰ
     * PHỤC VỤ — chính người tạo gửi chỉ tiêu của mình đi — nên áp luật cấp bậc vào đó sẽ so người
     * gửi với chính họ, mà hai vế luôn bằng nhau nên không ai gửi duyệt được nữa.
     */
    private KpiStatus resolveCriteriaTransition(
            KpiCriteria kpi, User actor,
            com.kpitracking.workflow.WorkflowAction action,
            ErrorCode statusRejectionCode,
            List<com.kpitracking.workflow.guard.TransitionGuard> authorityGuards,
            List<com.kpitracking.workflow.guard.TransitionGuard> invariants) {

        com.kpitracking.workflow.def.WorkflowDefinition definition =
                workflowConfigService.definitionFor(organizationIdOf(kpi));

        com.kpitracking.workflow.engine.TransitionContext<KpiStatus> ctx =
                com.kpitracking.workflow.engine.TransitionContext.<KpiStatus>builder()
                        .definition(definition)
                        .action(action)
                        .currentStatus(kpi.getStatus())
                        .actor(actor)
                        .orgUnitId(kpi.getOrgUnit().getId())
                        .target(kpi)
                        .targetOwnerId(kpi.getCreatedBy() == null ? null : kpi.getCreatedBy().getId())
                        .statusRejectionCode(statusRejectionCode)
                        .build();

        return workflowEngine.resolve(definition.criteria(), ctx, authorityGuards, invariants);
    }

    /** Hành động có khả dụng với chỉ tiêu này không (bước còn bật + trạng thái nhận). Không kiểm quyền. */
    private boolean canTransition(KpiCriteria kpi, com.kpitracking.workflow.WorkflowAction action) {
        com.kpitracking.workflow.def.WorkflowDefinition definition =
                workflowConfigService.definitionFor(organizationIdOf(kpi));
        return workflowEngine.canResolve(definition.criteria(),
                com.kpitracking.workflow.engine.TransitionContext.<KpiStatus>builder()
                        .definition(definition)
                        .action(action)
                        .currentStatus(kpi.getStatus())
                        .build());
    }

    private void requireStageEnabled(KpiCriteria kpi, com.kpitracking.workflow.WorkflowStage stage) {
        if (!workflowConfigService.definitionFor(organizationIdOf(kpi)).isStageEnabled(stage)) {
            throw new BusinessException(ErrorCode.ORGANIZATION_TURNED_OFF_KPI_APPROVAL_STEP_KPI);
        }
    }

    /**
     * Trạng thái của chỉ tiêu ngay khi vừa tạo.
     *
     * <p>Trước đây là {@code canApprove ? APPROVED : DRAFT} viết cứng, trong đó {@code canApprove}
     * là quyền {@code KPI:APPROVE_OWN}. Giờ còn phụ thuộc cấu hình: tổ chức tắt hẳn bước duyệt chỉ
     * tiêu thì chỉ tiêu ra đời đã duyệt, vì không còn ai để duyệt nó nữa.
     */
    private KpiStatus initialCriteriaStatus(UUID organizationId, User creator) {
        com.kpitracking.workflow.def.WorkflowDefinition definition =
                workflowConfigService.definitionFor(organizationId);

        if (!definition.isStageEnabled(com.kpitracking.workflow.WorkflowStage.CRITERIA_APPROVAL)) {
            return KpiStatus.APPROVED;
        }

        // Cả chuỗi duyệt lẫn luồng một cấp: người có KPI:APPROVE_OWN tạo chỉ tiêu là đã duyệt ngay.
        // Chuỗi duyệt chỉ dành cho chỉ tiêu của người KHÔNG có quyền tự duyệt.
        boolean allowSelfApprove = definition
                .stageConfig(com.kpitracking.workflow.WorkflowStage.CRITERIA_APPROVAL)
                .booleanOption("allowSelfApprove", true);

        return allowSelfApprove && permissionChecker.hasPermission(creator.getId(), "KPI:APPROVE_OWN")
                ? KpiStatus.APPROVED
                : KpiStatus.DRAFT;
    }

    @Transactional
    public KpiCriteriaResponse createKpiCriteria(CreateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();

        KpiStatus initialStatus = initialCriteriaStatus(getCurrentUserOrganizationId(currentUser), currentUser);

        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodRepository.findById(request.getKpiPeriodId())
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", request.getKpiPeriodId()));
        cycleStatusGuard.assertWritable(kpiPeriod);

        validateDeadlineWithinPeriod(request.getDeadline(), kpiPeriod);

        if (request.getFrequency().ordinal() > kpiPeriod.getPeriodType().ordinal()) {
            throw new BusinessException(ErrorCode.EVALUATION_FREQUENCY);
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
                throw new BusinessException(ErrorCode.USER_MUST_BELONG_LEAST_ONE_UNIT_CREATE);
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
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", assigneeId));
            assignees.add(assignee);
        }

        KpiCriteria lastKpi = null;
        for (UUID orgUnitId : targetOrgUnitIds) {
            OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", orgUnitId));

            // Permission check: only users with KPI:CREATE in the target OrgUnit can create
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnit.getId())) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_CREATE_KPIS_UNIT, orgUnit.getName());
            }

            validateWaterfallAssignment(currentUser, orgUnit, assignees);

            KpiCriteria kpi = buildKpiEntity(request, orgUnit, assignees, currentUser, initialStatus, kpiPeriod);
            requirePerspectiveWhenBscEnabled(kpi, "when.beforeCreate");
            if (initialStatus == KpiStatus.APPROVED) requireWithinFullWeight(kpi);
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
            throw new BusinessException(ErrorCode.DEADLINE_CANNOT_BEFORE_START_DATE_EVALUATION_PERIOD);
        }
        if (period.getEndDate() != null && deadline.isAfter(period.getEndDate())) {
            throw new BusinessException(ErrorCode.DEADLINE_CANNOT_AFTER_END_DATE_EVALUATION_PERIOD);
        }
    }

    private KpiCriteria buildKpiEntity(CreateKpiCriteriaRequest request, OrgUnit orgUnit, java.util.List<User> assignees, User creator, KpiStatus status, com.kpitracking.entity.KpiPeriod kpiPeriod) {
        com.kpitracking.enums.KpiType kpiType = request.getKpiType() != null
                ? request.getKpiType() : com.kpitracking.enums.KpiType.QUANTITATIVE;
        boolean isQualitative = kpiType == com.kpitracking.enums.KpiType.QUALITATIVE;

        if (isQualitative && (request.getWeight() == null || request.getWeight() <= 0)) {
            throw new BusinessException(ErrorCode.QUALITATIVE_KPIS_NEED_WEIGHT_GREATER_THAN_0);
        }

        if (!isQualitative) {
            validateReverseKpiThreshold(Boolean.TRUE.equals(request.getIsReverseKpi()),
                    request.getTargetValue(), request.getMinimumValue(), request.getName());
        }

        KpiCriteria kpi = KpiCriteria.builder()
                .orgUnit(orgUnit)
                .assignees(assignees)
                .kpiType(kpiType)
                .name(request.getName())
                .description(request.getDescription())
                .weight(request.getWeight())
                // Quantitative-only measurement fields are ignored for qualitative KPIs.
                .targetValue(isQualitative ? null : request.getTargetValue())
                .minimumValue(isQualitative ? null : request.getMinimumValue())
                .isReverseKpi(!isQualitative && Boolean.TRUE.equals(request.getIsReverseKpi()))
                .isBonusKpi(Boolean.TRUE.equals(request.getIsBonusKpi()))
                .unit(isQualitative ? null : request.getUnit())
                .deadline(request.getDeadline())
                .frequency(request.getFrequency())
                .status(status)
                .createdBy(creator)
                .kpiPeriod(kpiPeriod)
                .build();

        if (request.getParentId() != null) {
            KpiCriteria parent = kpiCriteriaRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.parentKpi"), "id", request.getParentId()));

            com.kpitracking.enums.KpiParentRelationType relationType = request.getParentRelationType() != null
                    ? request.getParentRelationType()
                    : com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION;

            if (relationType == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION) {
                boolean isParentOwner = parent.getCreatedBy() != null && parent.getCreatedBy().getId().equals(creator.getId());
                boolean isParentAssignee = parent.getAssignees() != null && parent.getAssignees().stream().anyMatch(a -> a.getId().equals(creator.getId()));
                if (!isParentOwner && !isParentAssignee
                        && !permissionChecker.isGlobalAdminIn(creator.getId(), parent.getOrgUnit() != null ? parent.getOrgUnit().getId() : null)) {
                    throw new ForbiddenException(ErrorCode.CAN_ONLY_SPLIT_KPIS_CREATED_YOURSELF_ASSIGNED);
                }

                double siblingWeight = parent.getChildren() != null ? parent.getChildren().stream()
                        .filter(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)
                        .mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0)
                        .sum() : 0.0;
                double newWeight = request.getWeight() != null ? request.getWeight() : 0.0;
                double parentWeight = parent.getWeight() != null ? parent.getWeight() : 0.0;

                if (siblingWeight + newWeight > parentWeight + 0.001) {
                    throw new BusinessException(ErrorCode.TOTAL_WEIGHT_CHILD_KPIS, String.valueOf((siblingWeight + newWeight)), String.valueOf(parentWeight));
                }
            }

            kpi.setParent(parent);
            kpi.setParentRelationType(relationType);
        }

        if (request.getKeyResultId() != null) {
            com.kpitracking.entity.KeyResult kr = keyResultRepository.findById(request.getKeyResultId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.keyResult"), "id", request.getKeyResultId()));
            
            // Validation: KPI OrgUnit must match one of the KeyResult Objective's OrgUnits
            if (orgUnit != null && kr.getObjective() != null && !kr.getObjective().getOrgUnits().isEmpty()) {
                boolean matching = kr.getObjective().getOrgUnits().stream()
                        .anyMatch(u -> u.getId().equals(orgUnit.getId()));
                if (!matching) {
                    String unitNames = kr.getObjective().getOrgUnits().stream()
                            .map(com.kpitracking.entity.OrgUnit::getName)
                            .collect(java.util.stream.Collectors.joining(", "));
                    throw new BusinessException(ErrorCode.KPI_MUST_BELONG_SAME_UNIT_LINKED_KEY, orgUnit.getName(), String.valueOf(unitNames));
                }
            }
            kpi.setKeyResult(kr);
        }

        if (request.getPerspectiveId() != null) {
            com.kpitracking.entity.BscPerspective perspective = bscPerspectiveRepository.findById(request.getPerspectiveId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.bscItem"), "id", request.getPerspectiveId()));
            kpi.setPerspective(perspective);
        }

        applyScorecardLink(kpi, request.getScorecardPerspectiveId());

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
    /**
     * Gắn KPI vào một DÒNG chỉ tiêu của bộ tiêu chí BSC (docs/bsc-cascade-design.md — QĐ-8).
     *
     * <p>Gắn xong thì đồng bộ luôn {@code perspective} theo dòng đó: báo cáo và thống kê cũ vẫn
     * gom theo hạng mục, để lệch nhau thì cùng một KPI xuất hiện ở hai nhóm khác nhau tuỳ màn hình.
     *
     * <p>{@code null} = gỡ liên kết, KPI trở lại chỉ tiêu tự do.
     */
    private void applyScorecardLink(KpiCriteria kpi, java.util.UUID scorecardPerspectiveId) {
        if (scorecardPerspectiveId == null) return;
        com.kpitracking.entity.BscScorecardPerspective row = bscScorecardPerspectiveRepository
                .findById(scorecardPerspectiveId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.bscKpi"), "id", scorecardPerspectiveId));
        kpi.setScorecardPerspective(row);
        kpi.setPerspective(row.getPerspective());
    }

    public PageResponse<KpiCriteriaResponse> getKpiCriteria(int page, int size, KpiStatus status, UUID orgUnitId, UUID createdById, UUID assigneeId, UUID kpiPeriodId, String keyword, Instant startDate, Instant endDate, String sortBy, String sortDir, UUID objectiveId, UUID keyResultId, UUID perspectiveId, boolean approvalMode, String kpiNature, Boolean isBonusKpi, Boolean isReverseKpi, com.kpitracking.enums.KpiType kpiType) {
        User currentUser = getCurrentUser();
        UUID organizationId = getCurrentUserOrganizationId(currentUser);

        // Ai thấy KPI nào: một luật duy nhất ở KpiAccessPolicy (truy vấn dưới viết lại đúng luật đó).
        // approvalMode không còn nới phạm vi xem — người đang/đã giữ bước duyệt đã thấy KPI qua luật chung.
        com.kpitracking.service.kpi.KpiAccessPolicy.Viewer viewer = kpiAccessPolicy.viewer(currentUser.getId(), organizationId);

        // When qualitative KPIs are disabled for the org, hide them entirely by
        // forcing the type filter to QUANTITATIVE (ignoring any incoming qualitative filter).
        com.kpitracking.enums.KpiType effectiveKpiType = organizationService.isQualitativeEnabled(organizationId)
                ? kpiType : com.kpitracking.enums.KpiType.QUANTITATIVE;

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
                viewer.managerUnitIdsForQuery(),
                viewer.memberUnitIdsForQuery(),
                viewer.admin(),
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
                perspectiveId,
                kpiNature,
                isBonusKpi,
                isReverseKpi,
                effectiveKpiType,
                pageable
        );

        List<KpiCriteriaResponse> content = kpiPage.getContent().stream().map(kpiCriteriaMapper::toResponse).toList();
        approvalView.enrichCriteria(content, currentUser.getId());
        collabEnricher.enrich(content, currentUser.getId());

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
    public KpiCriteriaResponse getKpiCriteriaById(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        
        // Người đang giữ bước duyệt (thường ở đơn vị cấp trên) xem được nhờ luật "nằm trong chuỗi duyệt".
        kpiAccessPolicy.assertCanView(currentUser.getId(), kpi);

        KpiCriteriaResponse response = kpiCriteriaMapper.toResponse(kpi);
        approvalView.enrichCriteria(List.of(response), currentUser.getId());
        collabEnricher.enrich(List.of(response), currentUser.getId());
        return response;
    }

    /**
     * Tạo MỘT chỉ tiêu con cho một đơn vị con từ chỉ tiêu cha — phần thực thi của lời mời phân rã
     * của trợ lý. Mọi thuộc tính (loại, đơn vị tính, tần suất, kỳ, tối thiểu tỉ lệ) chép từ cha; chỉ
     * mục tiêu và trọng số là phần chia. Đi qua đúng {@link #createKpiCriteria} nên luật quyền
     * ({@code KPI:CREATE} trên đơn vị con) và luật trọng số của kỳ áp như tạo tay.
     */
    @Transactional
    public KpiCriteriaResponse decomposeInto(UUID parentId, UUID childUnitId, Double targetValue, Double weight,
                                             com.kpitracking.enums.KpiParentRelationType relation) {
        KpiCriteria parent = kpiCriteriaRepository.findById(parentId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.parentKpi"), "id", parentId));
        OrgUnit child = orgUnitRepository.findById(childUnitId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", childUnitId));
        CreateKpiCriteriaRequest req = new CreateKpiCriteriaRequest();
        req.setName(parent.getName() + " — " + child.getName());
        req.setKpiType(parent.getKpiType());
        // Mô tả sinh sẵn cho KPI con — viết theo ngôn ngữ của người thao tác, người dùng sửa tự do sau đó.
        req.setDescription(ErrorMessages.text(relation == com.kpitracking.enums.KpiParentRelationType.DELEGATION
                        ? "kpi.childDescription.delegated" : "kpi.childDescription.cascaded", "",
                parent.getName(), parent.getOrgUnit() != null ? parent.getOrgUnit().getName() : ""));
        req.setWeight(weight);
        req.setTargetValue(targetValue);
        req.setUnit(parent.getUnit());
        req.setFrequency(parent.getFrequency());
        req.setOrgUnitId(childUnitId);
        req.setKpiPeriodId(parent.getKpiPeriod() != null ? parent.getKpiPeriod().getId() : null);
        if (parent.getMinimumValue() != null && parent.getTargetValue() != null && parent.getTargetValue() != 0 && targetValue != null) {
            // Giữ đúng TỈ LỆ tối thiểu/mục tiêu của cha, không chép nguyên con số.
            req.setMinimumValue(Math.round(targetValue * parent.getMinimumValue() / parent.getTargetValue() * 10.0) / 10.0);
        }
        req.setIsReverseKpi(parent.getIsReverseKpi());
        req.setIsBonusKpi(parent.getIsBonusKpi());
        req.setDeadline(parent.getDeadline());
        req.setParentId(parentId);
        req.setParentRelationType(relation);
        return createKpiCriteria(req);
    }

    @Transactional(readOnly = true)
    public List<KpiCriteriaResponse> getChildren(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));

        kpiAccessPolicy.assertCanView(currentUser.getId(), kpi);

        // KPI con nằm ở đơn vị khác — chỉ trả những con mà người xem cũng xem được.
        com.kpitracking.service.kpi.KpiAccessPolicy.Viewer viewer = kpiAccessPolicy.viewer(currentUser.getId(), com.kpitracking.service.kpi.KpiAccessPolicy.organizationIdOf(kpi));
        return kpiCriteriaRepository.findByParentId(kpiId).stream()
                .filter(c -> kpiAccessPolicy.canView(viewer, c))
                .map(kpiCriteriaMapper::toResponse)
                .toList();
    }

    @Transactional
    public KpiCriteriaResponse updateKpiCriteria(UUID kpiId, UpdateKpiCriteriaRequest request) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        cycleStatusGuard.assertWritable(kpi);

        boolean canUpdate = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:UPDATE", kpi.getOrgUnit().getId());
        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());

        if (!isCreator && !canUpdate) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_EDIT_KPI);
        }

        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        boolean enableWaterfall = org != null && org.getEnableWaterfall();
        boolean canApprove = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:APPROVE_ADJUSTMENT", kpi.getOrgUnit().getId());

        if (kpi.getStatus() != KpiStatus.DRAFT && kpi.getStatus() != KpiStatus.REJECTED && kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            if (enableWaterfall) {
                // Waterfall ON: Only allow managers to update approved KPIs (for delegation)
                if (!canApprove) {
                    throw new BusinessException(ErrorCode.ONLY_MANAGERS_MAY_ADJUST_APPROVED_KPIS_WATERFALL);
                }
            } else {
                // Waterfall OFF: Strict block - no one can update approved KPIs
                throw new BusinessException(ErrorCode.ONLY_KPIS_DRAFT_PENDING_APPROVAL_REJECTED_STATUS);
            }
        }

        WeightFootprint before = WeightFootprint.of(kpi);

        if (request.getName() != null) kpi.setName(request.getName());
        if (request.getDescription() != null) kpi.setDescription(request.getDescription());
        if (request.getWeight() != null) kpi.setWeight(request.getWeight());
        if (request.getTargetValue() != null) kpi.setTargetValue(request.getTargetValue());
        if (request.getMinimumValue() != null) kpi.setMinimumValue(request.getMinimumValue());
        if (request.getIsReverseKpi() != null) kpi.setIsReverseKpi(request.getIsReverseKpi());
        if (request.getIsBonusKpi() != null) kpi.setIsBonusKpi(request.getIsBonusKpi());
        if (request.getUnit() != null) kpi.setUnit(request.getUnit());

        // Validate trên giá trị SAU cập nhật (request có thể chỉ gửi một phần trường).
        if (kpi.getKpiType() != com.kpitracking.enums.KpiType.QUALITATIVE) {
            validateReverseKpiThreshold(Boolean.TRUE.equals(kpi.getIsReverseKpi()),
                    kpi.getTargetValue(), kpi.getMinimumValue(), kpi.getName());
        }
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
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.evaluationCycle"), "id", request.getKpiPeriodId()));
            cycleStatusGuard.assertWritable(kpiPeriod);
            kpi.setKpiPeriod(kpiPeriod);
            if (request.getDeadline() != null) {
                validateDeadlineWithinPeriod(request.getDeadline(), kpiPeriod);
            }
        }

        if (request.getFrequency() != null) {
            if (request.getFrequency().ordinal() > kpi.getKpiPeriod().getPeriodType().ordinal()) {
                throw new BusinessException(ErrorCode.EVALUATION_FREQUENCY);
            }
            kpi.setFrequency(request.getFrequency());
        }

        if (request.getOrgUnitId() != null) {
            OrgUnit orgUnit = orgUnitRepository.findById(request.getOrgUnitId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.unit"), "id", request.getOrgUnitId()));
            
            // Check if user has permission to move KPI to this new OrgUnit
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnit.getId())) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_CREATE_MOVE_KPIS_NEW_UNIT);
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
                            .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.employee"), "id", id));

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
                            .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", id)));
                }
                kpi.setAssignees(assignees);
                validateWaterfallAssignment(currentUser, kpi.getOrgUnit(), assignees);
            }
        } else if (request.getAssignedToId() != null) {
            // Legacy single ID handling
            User assignee = userRepository.findById(request.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", request.getAssignedToId()));
            kpi.setAssignees(java.util.List.of(assignee));
        }

        if (request.getKeyResultId() != null) {
            com.kpitracking.entity.KeyResult kr = keyResultRepository.findById(request.getKeyResultId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.keyResult"), "id", request.getKeyResultId()));
            kpi.setKeyResult(kr);
        } else if (request.getKeyResultId() == null && request.getName() != null) {
            // Keep existing keyResult if not provided in the update
        }

        if (request.getPerspectiveId() != null) {
            com.kpitracking.entity.BscPerspective perspective = bscPerspectiveRepository.findById(request.getPerspectiveId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.bscItem"), "id", request.getPerspectiveId()));
            kpi.setPerspective(perspective);
        }

        applyScorecardLink(kpi, request.getScorecardPerspectiveId());

        if (request.getParentId() != null) {
            KpiCriteria parent = kpiCriteriaRepository.findById(request.getParentId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.parentKpi"), "id", request.getParentId()));
            kpi.setParent(parent);
            if (request.getParentRelationType() != null) {
                kpi.setParentRelationType(request.getParentRelationType());
            }
        }

        requirePerspectiveWhenBscEnabled(kpi, "when.beforeSave");
        if (COMMITTED_WITHOUT_APPROVAL.contains(kpi.getStatus()) && before.grewOrMoved(kpi)) requireWithinFullWeight(kpi);
        kpi = kpiCriteriaRepository.save(kpi);
        return kpiCriteriaMapper.toResponse(kpi);
    }

    /**
     * Trạng thái mà trọng số đã tính vào 100% và sửa xong KHÔNG phải duyệt lại — sửa ở đây là chốt luôn,
     * nên phải tự chốt "không vượt 100%". PENDING_APPROVAL không nằm đây: sửa xong vẫn còn người duyệt.
     */
    private static final java.util.Set<KpiStatus> COMMITTED_WITHOUT_APPROVAL = java.util.EnumSet.of(
            KpiStatus.APPROVED, KpiStatus.EDIT, KpiStatus.EDITED);

    /**
     * Những gì quyết định chỉ tiêu cộng bao nhiêu vào 100% của đơn vị nào. Chỉ chốt khi một trong số đó đổi
     * theo hướng có thể làm tăng — sửa tên / mô tả một chỉ tiêu của đơn vị vốn đã lệch thì không bị chặn.
     */
    private record WeightFootprint(double weight, UUID orgUnitId, UUID kpiPeriodId, java.util.Set<UUID> assigneeIds, boolean bonus) {
        static WeightFootprint of(KpiCriteria kpi) {
            return new WeightFootprint(
                    kpi.getWeight() != null ? kpi.getWeight() : 0.0,
                    kpi.getOrgUnit() != null ? kpi.getOrgUnit().getId() : null,
                    kpi.getKpiPeriod() != null ? kpi.getKpiPeriod().getId() : null,
                    kpi.getAssignees() == null ? java.util.Set.of()
                            : kpi.getAssignees().stream().map(User::getId).collect(java.util.stream.Collectors.toSet()),
                    Boolean.TRUE.equals(kpi.getIsBonusKpi()));
        }

        boolean grewOrMoved(KpiCriteria after) {
            WeightFootprint now = of(after);
            return now.weight > weight + 0.001
                    || (bonus && !now.bonus)
                    || !java.util.Objects.equals(now.orgUnitId, orgUnitId)
                    || !java.util.Objects.equals(now.kpiPeriodId, kpiPeriodId)
                    || !now.assigneeIds.equals(assigneeIds);
        }
    }
    @Transactional
    public KpiCriteriaResponse submitForApproval(UUID kpiId) {
        List<KpiCriteriaResponse> results = bulkSubmitForApproval(java.util.List.of(kpiId));
        if (results.isEmpty()) {
            throw new BusinessException(ErrorCode.KPI_CANNOT_SUBMITTED_APPROVAL);
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
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiIds.get(0)));

        // Bước duyệt chỉ tiêu bị tắt thì không có gì để gửi duyệt. Báo ngay một lần ở đây thay vì
        // để vòng lặp bên dưới bỏ qua từng bản rồi trả về danh sách rỗng không rõ nguyên nhân.
        requireStageEnabled(firstKpi, com.kpitracking.workflow.WorkflowStage.CRITERIA_APPROVAL);

        // Lọc lô trước khi kiểm trọng số: chỉ tiêu không phải của mình hoặc không ở trạng thái gửi
        // được thì bỏ qua (đường hàng loạt, một bản hỏng không làm hỏng cả lô). Phải biết lô thật sự
        // gồm những gì rồi mới kiểm được "gửi xong có đủ 100% không".
        List<KpiCriteria> batch = new ArrayList<>();
        for (UUID kpiId : kpiIds) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId).orElse(null);
            if (kpi == null) continue;
            // Kỳ đã khoá thì báo rõ thay vì lặng lẽ bỏ qua như các bản không gửi được khác.
            cycleStatusGuard.assertWritable(kpi);
            if (!kpi.getCreatedBy().getId().equals(currentUser.getId())) continue;
            // Trạng thái nào gửi duyệt được là do bảng chuyển quyết định, không còn là điều kiện
            // viết cứng ở đây.
            if (!canTransition(kpi, com.kpitracking.workflow.WorkflowAction.SUBMIT_CRITERIA)) continue;
            batch.add(kpi);
        }

        requireBatchCoversFullWeight(firstKpi.getOrgUnit().getId(), firstKpi.getKpiPeriod().getId(), batch);

        for (KpiCriteria kpi : batch) {
            if (kpi.getParent() != null && kpi.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION) {
                KpiCriteria parent = kpi.getParent();
                double siblingWeight = parent.getChildren() != null ? parent.getChildren().stream()
                        .filter(c -> c.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION)
                        .mapToDouble(c -> c.getWeight() != null ? c.getWeight() : 0.0)
                        .sum() : 0.0;
                double parentWeight = parent.getWeight() != null ? parent.getWeight() : 0.0;
                if (Math.abs(siblingWeight - parentWeight) > 0.001) {
                    throw new BusinessException(ErrorCode.TOTAL_WEIGHT_CHILD_KPIS_2, parent.getName(), String.valueOf(siblingWeight), String.valueOf(parentWeight));
                }
            }

            // Không có chốt chặn thẩm quyền: quyền sở hữu đã được kiểm ngay đầu vòng lặp
            // (chỉ người tạo mới gửi duyệt được chỉ tiêu của mình).
            kpi.setStatus(resolveCriteriaTransition(kpi, currentUser,
                    com.kpitracking.workflow.WorkflowAction.SUBMIT_CRITERIA,
                    null, List.of(), List.of()));
            kpi.setSubmittedAt(Instant.now());
            kpi.setRejectReason(null);
            kpi = kpiCriteriaRepository.save(kpi);

            if (approvalChain.isChainMode(kpi)) {
                // Gửi (hoặc gửi lại sau khi bị từ chối) luôn lập chuỗi MỚI theo cơ cấu hiện tại, từ bước đầu.
                var started = approvalChain.startCriteria(kpi, currentUser,
                        com.kpitracking.enums.ApprovalEventAction.SUBMITTED, true);
                if (started.selfApproved()) {
                    markApproved(kpi, currentUser);
                    kpi = kpiCriteriaRepository.save(kpi);
                    eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
                } else {
                    eventPublisher.publishEvent(new KpiCriteriaSubmittedForApprovalEvent(this, kpi));
                }
            } else {
                eventPublisher.publishEvent(new KpiCriteriaSubmittedForApprovalEvent(this, kpi));
            }
            results.add(kpiCriteriaMapper.toResponse(kpi));
        }
        approvalView.enrichCriteria(results, currentUser.getId());

        return results;
    }

    /**
     * Chốt 100% của bước gửi duyệt.
     *
     * <p>Trước đây chốt này cộng mọi chỉ tiêu của đơn vị, kể cả bản NHÁP không nằm trong lô. Hệ quả
     * đo thật: đơn vị có 5 chỉ tiêu 80% đã duyệt + 1 bản nháp 20% (sinh ra khi thay thế một KPI đã
     * duyệt) vẫn qua chốt vì "tổng khai" là 100%, rồi bản nháp không bao giờ được gửi tiếp và sang
     * kỳ chấm người đó chỉ còn 80%. Nên chỉ được tính (a) chỉ tiêu đang gửi trong lô này và (b) chỉ
     * tiêu đã vào luồng duyệt từ trước; nháp / bị từ chối bỏ ngoài lô thì kể tên ra để người gửi
     * chọn nốt.
     */
    private void requireBatchCoversFullWeight(UUID orgUnitId, UUID kpiPeriodId, List<KpiCriteria> batch) {
        java.util.Set<UUID> batchIds = batch.stream().map(KpiCriteria::getId).collect(java.util.stream.Collectors.toSet());
        List<KpiCriteria> counted = kpiCriteriaRepository.findByOrgUnitIdAndKpiPeriodIdAndStatusIn(orgUnitId, kpiPeriodId, WEIGHT_COUNTED_STATUSES);

        List<KpiCriteria> leftOut = new ArrayList<>();
        List<KpiCriteria> covered = new ArrayList<>();
        for (KpiCriteria kpi : counted) {
            // KPI đang chờ bản thay thế: đếm bản thay (nằm trong lô hoặc đang chờ duyệt), không đếm cả hai.
            if (hasPendingReplacement(kpi)) continue;
            if (batchIds.contains(kpi.getId()) || IN_APPROVAL_PIPELINE_STATUSES.contains(kpi.getStatus())) {
                covered.add(kpi);
            } else {
                leftOut.add(kpi);
            }
        }

        double totalWeight = totalWeightOfUnit(covered);
        if (Math.abs(totalWeight - 100.0) <= 0.001) return;

        if (!leftOut.isEmpty()) {
            double leftOutWeight = leftOut.stream()
                    .filter(k -> !Boolean.TRUE.equals(k.getIsBonusKpi()) && !hasDecompositionChildren(k))
                    .mapToDouble(this::effectiveWeight).sum();
            String names = leftOut.stream().map(KpiCriteria::getName).limit(5).collect(java.util.stream.Collectors.joining(", "));
            if (leftOut.size() > 5) names += ", …";
            throw new BusinessException(ErrorCode.AFTER_SUBMITTING_UNIT_ONLY_REACHES_PERCENT_WEIGHT, String.valueOf(formatWeight(totalWeight)), leftOut.size(), String.valueOf(formatWeight(leftOutWeight)), String.valueOf(names));
        }
        throw new BusinessException(ErrorCode.UNIT_TOTAL_WEIGHT_HEADCOUNT_ALLOCATION, String.valueOf(formatWeight(totalWeight)));
    }

    /**
     * Chốt "không vượt 100%" cho chỉ tiêu ra đời đã duyệt (người có KPI:APPROVE_OWN, hoặc tổ chức tắt
     * bước duyệt), và cho chỉ tiêu ĐÃ DUYỆT bị sửa trọng số / đơn vị / người được giao. Cả hai không đi
     * qua {@link #requireBatchCoversFullWeight} của bước gửi duyệt, nên không chặn ở đây thì đơn vị vượt
     * 100% mà không ai hay. Chỉ tiêu đang sửa ({@code id} khác null) được trừ khỏi phần "đã dùng".
     *
     * <p>Chỉ cộng phần đã vào luồng duyệt ({@code IN_APPROVAL_PIPELINE_STATUSES}) — bản nháp chưa chắc
     * được gửi, cùng lý do như chốt gửi duyệt. KPI thưởng và KPI con phân rã (trọng số cắt từ KPI cha,
     * đã có chốt riêng) không tính.
     */
    private void requireWithinFullWeight(KpiCriteria newKpi) {
        if (Boolean.TRUE.equals(newKpi.getIsBonusKpi())) return;
        if (newKpi.getParent() != null
                && newKpi.getParentRelationType() == com.kpitracking.enums.KpiParentRelationType.DECOMPOSITION) return;
        if (newKpi.getOrgUnit() == null || newKpi.getKpiPeriod() == null) return;

        List<UUID> assigneeIds = newKpi.getAssignees() == null ? List.of()
                : newKpi.getAssignees().stream().map(User::getId).toList();
        double used = usedWeightInUnit(newKpi.getOrgUnit().getId(), newKpi.getKpiPeriod().getId(), assigneeIds, newKpi.getId());
        double adding = effectiveWeight(newKpi);
        if (used + adding > 100.0 + 0.001) {
            throw new BusinessException(newKpi.getId() == null
                            ? ErrorCode.SELF_APPROVED_KPI_EXCEEDS_FULL_WEIGHT
                            : ErrorCode.APPROVED_KPI_EDIT_EXCEEDS_FULL_WEIGHT,
                    newKpi.getOrgUnit().getName(), formatWeight(used), formatWeight(adding),
                    formatWeight(Math.max(0.0, 100.0 - used)));
        }
    }

    /**
     * Trọng số đã dùng mà một chỉ tiêu MỚI giao cho {@code assigneeIds} sẽ cộng thêm vào, theo đúng công
     * thức {@link #totalWeightOfUnit}: KPI chưa giao + người cao nhất. Giao cho người cụ thể thì "người cao
     * nhất" chỉ xét trong những người được giao; không giao ai thì KPI cộng thẳng vào phần chưa giao.
     */
    private double usedWeightInUnit(UUID orgUnitId, UUID kpiPeriodId, java.util.Collection<UUID> assigneeIds, UUID excludeKpiId) {
        List<KpiCriteria> committed = kpiCriteriaRepository.findByOrgUnitIdAndKpiPeriodIdAndStatusIn(
                orgUnitId, kpiPeriodId, new ArrayList<>(IN_APPROVAL_PIPELINE_STATUSES));
        double unassigned = 0.0;
        Map<UUID, Double> userWeights = new HashMap<>();
        for (KpiCriteria kpi : committed) {
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi()) || hasDecompositionChildren(kpi) || hasPendingReplacement(kpi)) continue;
            if (kpi.getId() != null && kpi.getId().equals(excludeKpiId)) continue;
            double weight = effectiveWeight(kpi);
            if (kpi.getAssignees() == null || kpi.getAssignees().isEmpty()) {
                unassigned += weight;
            } else {
                for (User assignee : kpi.getAssignees()) userWeights.merge(assignee.getId(), weight, Double::sum);
            }
        }
        double top = assigneeIds == null || assigneeIds.isEmpty()
                ? userWeights.values().stream().max(Double::compare).orElse(0.0)
                : assigneeIds.stream().mapToDouble(id -> userWeights.getOrDefault(id, 0.0)).max().orElse(0.0);
        return unassigned + top;
    }

    /** Trọng số còn trống cho form tạo chỉ tiêu — cùng con số mà {@link #requireWithinFullWeight} chốt. */
    public record WeightHeadroom(boolean selfApproved, List<UnitWeightUsage> units) {}

    public record UnitWeightUsage(UUID orgUnitId, String orgUnitName, double usedWeight) {}

    @Transactional(readOnly = true)
    public WeightHeadroom getWeightHeadroom(UUID kpiPeriodId, List<UUID> orgUnitIds, List<UUID> assigneeIds, UUID excludeKpiId) {
        User currentUser = getCurrentUser();
        boolean selfApproved = initialCriteriaStatus(getCurrentUserOrganizationId(currentUser), currentUser) == KpiStatus.APPROVED;
        // Sửa chỉ tiêu đã duyệt (excludeKpiId) thì luôn chốt 100%, không phụ thuộc quyền tự duyệt.
        boolean checks = selfApproved || excludeKpiId != null;
        List<UnitWeightUsage> units = new ArrayList<>();
        if (checks && kpiPeriodId != null && orgUnitIds != null) {
            for (UUID orgUnitId : orgUnitIds) {
                // Chỉ đơn vị người này được tạo / sửa chỉ tiêu — không lộ số của đơn vị khác.
                if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:CREATE", orgUnitId)
                        && !permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:UPDATE", orgUnitId)) continue;
                OrgUnit unit = orgUnitRepository.findById(orgUnitId).orElse(null);
                if (unit == null) continue;
                units.add(new UnitWeightUsage(orgUnitId, unit.getName(), usedWeightInUnit(orgUnitId, kpiPeriodId, assigneeIds, excludeKpiId)));
            }
        }
        return new WeightHeadroom(selfApproved, units);
    }

    private static String formatWeight(double weight) {
        return weight == Math.rint(weight) ? String.valueOf((long) weight) : String.valueOf(Math.round(weight * 100.0) / 100.0);
    }

    /** Kết quả một lần duyệt: đã chốt, hay mới chuyển lên bước kế tiếp (và ai giữ bước đó). */
    public record ApproveResult(KpiCriteriaResponse response,
                                com.kpitracking.enums.ApprovalOutcome outcome,
                                String nextHolderNames) {}

    @Transactional
    public KpiCriteriaResponse approveKpi(UUID kpiId) {
        return approveKpiWithOutcome(kpiId, null).response();
    }

    @Transactional
    public ApproveResult approveKpiWithOutcome(UUID kpiId,
                                               com.kpitracking.dto.request.kpi.approval.ApproveKpiRequest request) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        cycleStatusGuard.assertWritable(kpi);

        if (approvalChain.isChainMode(kpi)) {
            return approveInChain(kpi, currentUser,
                    request == null ? null : request.getExpectedStepId(),
                    request == null ? null : request.getComment());
        }

        // Bản tham chiếu bất biến cho lambda: biến kpi bị gán lại sau khi lưu nên không dùng
        // trực tiếp trong guard được.
        final KpiCriteria target = kpi;
        KpiStatus next = resolveCriteriaTransition(kpi, currentUser,
                com.kpitracking.workflow.WorkflowAction.APPROVE_CRITERIA,
                "KPI:APPROVE_CRITERIA", "verb.approve",
                ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_APPROVED,
                List.of(
                        ctx -> { requirePerspectiveWhenBscEnabled(target, "when.beforeApprove"); return com.kpitracking.workflow.engine.GuardResult.ok(); },
                        ctx -> { requireCategoryWeightSum100OnApprove(target); return com.kpitracking.workflow.engine.GuardResult.ok(); }
                ));

        kpi.setStatus(next);
        kpi.setApprovedBy(currentUser);
        kpi.setApprovedAt(Instant.now());
        completeReplacementOf(kpi, currentUser);
        kpi = kpiCriteriaRepository.save(kpi);
        // Tổ chức vừa chuyển về luồng một cấp: chuỗi cũ (nếu còn) không còn ý nghĩa.
        approvalChain.cancelRunning(List.of(kpi.getId()), currentUser, LocalizedText.of("approvalEvent.reason.approvedSingleLevel"));

        eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));

        return new ApproveResult(kpiCriteriaMapper.toResponse(kpi), com.kpitracking.enums.ApprovalOutcome.FINAL, null);
    }

    /**
     * Duyệt theo chuỗi. Chỉ người đang giữ bước hiện tại được bấm (admin cũng không duyệt thay).
     * Có quyền duyệt cuối (hoặc là bước cuối) ⇒ chạy đủ ràng buộc nghiệp vụ như luồng cũ rồi chốt
     * APPROVED; không thì KPI vẫn CHỜ DUYỆT và chuỗi chuyển lên bước kế tiếp.
     */
    private ApproveResult approveInChain(KpiCriteria kpi, User actor, UUID expectedStepId, String comment) {
        requireStageEnabled(kpi, com.kpitracking.workflow.WorkflowStage.CRITERIA_APPROVAL);
        if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
            throw new BusinessException(ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_APPROVED);
        }
        var decision = approvalChain.authorize(ensureChain(kpi), actor, expectedStepId);

        if (!decision.finalApproval()) {
            approvalChain.approve(decision, actor, comment);
            KpiCriteriaResponse response = kpiCriteriaMapper.toResponse(kpi);
            approvalView.enrichCriteria(List.of(response), actor.getId());
            String nextHolders = decision.flow().currentStep()
                    .map(com.kpitracking.entity.KpiApprovalStep::approverNames).orElse(null);
            return new ApproveResult(response, com.kpitracking.enums.ApprovalOutcome.FORWARDED, nextHolders);
        }

        final KpiCriteria target = kpi;
        KpiStatus next = resolveCriteriaTransition(kpi, actor,
                com.kpitracking.workflow.WorkflowAction.APPROVE_CRITERIA,
                ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_APPROVED,
                List.of(),
                List.of(
                        ctx -> { requirePerspectiveWhenBscEnabled(target, "when.beforeApprove"); return com.kpitracking.workflow.engine.GuardResult.ok(); },
                        ctx -> { requireCategoryWeightSum100OnApprove(target); return com.kpitracking.workflow.engine.GuardResult.ok(); }
                ));
        approvalChain.approve(decision, actor, comment);
        kpi.setStatus(next);
        markApproved(kpi, actor);
        kpi = kpiCriteriaRepository.save(kpi);
        eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, kpi));
        return new ApproveResult(kpiCriteriaMapper.toResponse(kpi), com.kpitracking.enums.ApprovalOutcome.FINAL, null);
    }

    /**
     * Id flow đang chạy của chỉ tiêu. KPI đang chờ theo luồng cũ mà chưa được chuyển đổi (xem
     * {@code ApprovalChainBackfillService}) thì lập chuỗi ngay tại đây, không thông báo, với người
     * gửi là người tạo.
     */
    private UUID ensureChain(KpiCriteria kpi) {
        return approvalChain.runningCriteriaFlowId(kpi.getId()).orElseGet(() ->
                approvalChain.startCriteria(kpi, kpi.getCreatedBy(),
                        com.kpitracking.enums.ApprovalEventAction.MIGRATED, false).flow().getId());
    }

    private void markApproved(KpiCriteria kpi, User approver) {
        kpi.setStatus(KpiStatus.APPROVED);
        kpi.setApprovedBy(approver);
        kpi.setApprovedAt(Instant.now());
        completeReplacementOf(kpi, approver);
    }

    /**
     * Bản thay thế vừa được duyệt cuối ⇒ KPI cũ mới chính thức thành REPLACED (quyết định C8b).
     * Trước đó KPI cũ vẫn chạy bình thường, để bản thay bị từ chối thì người thực hiện không mất cả hai.
     */
    private void completeReplacementOf(KpiCriteria replacement, User actor) {
        if (replacement.getId() == null) return;
        for (KpiCriteria old : kpiCriteriaRepository.findByReplacedById(replacement.getId())) {
            if (old.getStatus() == KpiStatus.REPLACED) continue;
            old.setStatus(KpiStatus.REPLACED);
            kpiCriteriaRepository.save(old);
            approvalChain.cancelRunning(List.of(old.getId()), actor,
                    LocalizedText.of("approvalEvent.reason.replaced", replacement.getName()));
            collabHooks.onReplaced(old, replacement);
        }
    }

    /** KPI đang chờ bản thay thế được duyệt: trọng số của nó do bản thay đảm nhận khi đếm 100%. */
    private static boolean hasPendingReplacement(KpiCriteria kpi) {
        return kpi.getReplacedBy() != null && kpi.getStatus() != KpiStatus.REPLACED;
    }

    /**
     * Khi tổ chức bật BSC: KPI có tham gia tính điểm BSC (cả định lượng lẫn định tính) BẮT BUỘC
     * phải được gán lĩnh vực trước khi duyệt — để tới kỳ đánh giá mọi KPI đã duyệt đều có lĩnh vực
     * (coverage = 100%). KPI thưởng / KPI cha phân rã / KPI huỷ không tính điểm nên không bắt buộc.
     *
     * CHỈ áp dụng khi KỲ của KPI đã có bộ tiêu chí — kỳ chưa có bộ tiêu chí thì không có trọng số lĩnh vực
     * ⇒ không sinh điểm BSC ⇒ đòi gán lĩnh vực là ép vô ích, chặn duyệt KPI vô cớ.
     */
    /**
     * KPI ngược (càng thấp càng tốt): {@code minimumValue} là NGƯỠNG TỆ NHẤT chấp nhận được
     * nên bắt buộc phải LỚN HƠN {@code targetValue}.
     * Nếu cấu hình ngược lại (min <= target) thì đạt đúng mục tiêu cũng đã vượt ngưỡng
     * ⇒ mọi bài nộp đều bị hệ thống tự động từ chối và KPI vĩnh viễn 0 điểm.
     * (KPI thường thì ngược lại: min là sàn, phải nhỏ hơn hoặc bằng target.)
     */
    private void validateReverseKpiThreshold(boolean isReverse, Double target, Double minimum, String kpiName) {
        if (target == null || minimum == null) return;
        String label = kpiName != null ? "'" + kpiName + "'" : "";
        if (isReverse) {
            if (minimum <= target) {
                throw new BusinessException(ErrorCode.INVERSE_KPI, String.valueOf(label), String.valueOf(minimum), String.valueOf(target));
            }
        } else if (minimum > target) {
            throw new BusinessException(ErrorCode.KPI, String.valueOf(label), String.valueOf(minimum), String.valueOf(target));
        }
    }

    /**
     * Có bắt KPI phải gắn hạng mục BSC không: chỉ khi CHÍNH đơn vị của KPI có bộ tiêu chí (còn dùng,
     * chưa xoá) áp cho đợt này. Công ty có bộ mà đơn vị mình chưa dựng bộ riêng thì KHÔNG chặn — đơn
     * vị chưa sẵn sàng thì không thể bắt nhân viên gắn vào hạng mục họ còn chưa được giao.
     *
     * <p>Dùng chung cách tra với chấm điểm ({@link BscScoringService#resolveScorecard}) — cũng chỉ
     * xét đúng đơn vị — nên "bị bắt gắn hạng mục" và "được chấm theo BSC" luôn là một.
     */
    private boolean scoredByBsc(KpiCriteria kpi, Organization org) {
        return bscScoringService.resolveScorecard(kpi.getOrgUnit(), org.getId(), kpi.getKpiPeriod().getId()) != null;
    }

    /**
     * Chặn ngay từ lúc TẠO/SỬA (không đợi tới lúc duyệt): kỳ chứa đợt đã có bộ tiêu chí BSC thì KPI
     * tính điểm phải gắn hạng mục, nếu không người tạo chỉ phát hiện khi cấp trên bấm duyệt.
     * {@code when} là cụm "trước khi …" ghép vào thông báo lỗi.
     */
    private void requirePerspectiveWhenBscEnabled(KpiCriteria kpi, String whenKey) {
        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        if (org == null || !Boolean.TRUE.equals(org.getEnableBsc())) return;
        if (kpi.getKpiPeriod() == null) return;
        if (!scoredByBsc(kpi, org)) return;
        if (!achievementCalculator.countsTowardBscScore(kpi)) return;
        // KPI có thể suy lĩnh vực từ Objective cha (OKR) ⇒ dùng lĩnh vực HIỆU LỰC, không đòi gán trực tiếp.
        if (com.kpitracking.util.BscPerspectiveResolver.effectivePerspective(kpi) == null) {
            throw new BusinessException(ErrorCode.CYCLE_USES_BSC_SCORECARD, kpi.getKpiPeriod().getName(), kpi.getName(), Terms.of(whenKey));
        }
    }

    /**
     * Khi org bật BSC & kỳ có bộ tiêu chí: tổng trọng số các KPI (tính điểm) trong CÙNG một HẠNG MỤC
     * — cùng phòng ban + cùng kỳ + cùng lĩnh vực hiệu lực — phải = 100% trước khi duyệt (xem ảnh 3).
     * Đây là ràng buộc chặn CỨNG lúc duyệt; lúc tạo/sửa chỉ cảnh báo mềm (phía FE) để user xây dần.
     */
    private void requireCategoryWeightSum100OnApprove(KpiCriteria kpi) {
        Organization org = kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization();
        if (org == null || !Boolean.TRUE.equals(org.getEnableBsc())) return;
        if (kpi.getKpiPeriod() == null) return;
        if (!scoredByBsc(kpi, org)) return;
        if (!achievementCalculator.countsTowardBscScore(kpi)) return;

        com.kpitracking.entity.BscPerspective category =
                com.kpitracking.util.BscPerspectiveResolver.effectivePerspective(kpi);
        if (category == null) return; // đã bị chặn ở requirePerspectiveWhenBscEnabled

        UUID categoryId = category.getId();
        // Tổng trọng số các KPI đang hiệu lực cùng hạng mục (loại chính KPI này ra để tránh đếm 2 lần),
        // cộng thêm trọng số của KPI sắp duyệt.
        double siblingSum = kpiCriteriaRepository
                .findByOrgUnitIdAndKpiPeriodIdAndStatusIn(kpi.getOrgUnit().getId(), kpi.getKpiPeriod().getId(),
                        com.kpitracking.service.BscScoringService.ACTIVE_STATUSES)
                .stream()
                .filter(k -> !k.getId().equals(kpi.getId()))
                // KPI cũ đang chờ chính bản này thay thế: bản này đảm nhận trọng số của nó.
                .filter(k -> k.getReplacedBy() == null || !k.getReplacedBy().getId().equals(kpi.getId()))
                .filter(achievementCalculator::countsTowardBscScore)
                .filter(k -> categoryId.equals(com.kpitracking.util.BscPerspectiveResolver.effectivePerspectiveId(k)))
                .mapToDouble(k -> k.getWeight() != null ? k.getWeight() : 0.0)
                .sum();
        double total = siblingSum + (kpi.getWeight() != null ? kpi.getWeight() : 0.0);

        if (Math.abs(total - 100.0) > 0.01) {
            throw new BusinessException(ErrorCode.CANNOT_APPROVE, category.getName(), String.valueOf(round1(total)));
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    @Transactional
    public KpiCriteriaResponse rejectKpi(UUID kpiId, RejectKpiRequest request) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        cycleStatusGuard.assertWritable(kpi);

        KpiStatus next;
        if (approvalChain.isChainMode(kpi)) {
            // Từ chối ở bất kỳ bước nào ⇒ về người tạo; gửi lại thì chạy lại chuỗi từ bước đầu.
            requireStageEnabled(kpi, com.kpitracking.workflow.WorkflowStage.CRITERIA_APPROVAL);
            if (kpi.getStatus() != KpiStatus.PENDING_APPROVAL) {
                throw new BusinessException(ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_REJECTED);
            }
            var decision = approvalChain.authorize(ensureChain(kpi), currentUser, request.getExpectedStepId());
            next = resolveCriteriaTransition(kpi, currentUser,
                    com.kpitracking.workflow.WorkflowAction.REJECT_CRITERIA,
                    ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_REJECTED, List.of(), List.of());
            approvalChain.reject(decision, currentUser, request.getReason());
        } else {
            next = resolveCriteriaTransition(kpi, currentUser,
                    com.kpitracking.workflow.WorkflowAction.REJECT_CRITERIA,
                    "KPI:APPROVE_CRITERIA", "verb.reject",
                    ErrorCode.ONLY_KPIS_PENDING_APPROVAL_STATUS_CAN_REJECTED,
                    List.of());
            approvalChain.cancelRunning(List.of(kpi.getId()), currentUser, LocalizedText.of("approvalEvent.reason.rejectedSingleLevel"));
        }

        kpi.setStatus(next);
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
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        cycleStatusGuard.assertWritable(kpi);

        KpiStatus next = resolveCriteriaTransition(kpi, currentUser,
                com.kpitracking.workflow.WorkflowAction.REVERT_CRITERIA_APPROVAL,
                "KPI:REVERT_APPROVAL", "verb.revertApproval",
                ErrorCode.ONLY_APPROVED_KPIS_CAN_REVERTED,
                List.of());

        kpi.setStatus(next);
        kpi.setApprovedBy(null);
        kpi.setApprovedAt(null);
        if (next == KpiStatus.REJECTED) {
            // Chuỗi duyệt (C11b): hoàn duyệt trả KPI về người tạo như một lần từ chối.
            kpi.setRejectReason(ErrorMessages.text("kpi.rejectReason.reverted", "", currentUser.getFullName()));
        }
        kpi = kpiCriteriaRepository.save(kpi);

        eventPublisher.publishEvent(new KpiCriteriaApprovalRevertedEvent(this, kpi, currentUser));
        collabHooks.onApprovalReverted(kpi, currentUser);

        return kpiCriteriaMapper.toResponse(kpi);
    }

    @Transactional
    public void deleteKpiCriteria(UUID kpiId) {
        User currentUser = getCurrentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        cycleStatusGuard.assertWritable(kpi);

        boolean canDelete = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:DELETE", kpi.getOrgUnit().getId());
        boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());

        if (!isCreator && !canDelete) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_DELETE_KPI);
        }
        kpi.setDeletedAt(Instant.now());
        kpiCriteriaRepository.save(kpi);
        onDeleted(kpi, currentUser);
    }

    /** KPI bị xoá: dừng chuỗi duyệt của nó; nếu nó là bản thay thế đang chờ thì KPI cũ thôi chờ. */
    private void onDeleted(KpiCriteria kpi, User actor) {
        approvalChain.cancelRunning(List.of(kpi.getId()), actor, LocalizedText.of("approvalEvent.reason.kpiDeleted"));
        collabHooks.onDeleted(kpi);
        for (KpiCriteria old : kpiCriteriaRepository.findByReplacedById(kpi.getId())) {
            if (old.getStatus() == KpiStatus.REPLACED) continue;
            old.setReplacedBy(null);
            old.setReplacementReason(null);
            kpiCriteriaRepository.save(old);
        }
    }

    /** Xoá mềm nhiều chỉ tiêu trong một lượt; bỏ qua chỉ tiêu không còn tồn tại. */
    @Transactional
    public int bulkDeleteKpiCriteria(List<UUID> kpiIds) {
        if (kpiIds == null || kpiIds.isEmpty()) return 0;
        User currentUser = getCurrentUser();
        int deleted = 0;

        for (UUID kpiId : kpiIds) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId).orElse(null);
            if (kpi == null) continue;
            cycleStatusGuard.assertWritable(kpi);

            boolean canDelete = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:DELETE", kpi.getOrgUnit().getId());
            boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());
            if (!isCreator && !canDelete) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_DELETE_KPI);
            }

            kpi.setDeletedAt(Instant.now());
            kpiCriteriaRepository.save(kpi);
            onDeleted(kpi, currentUser);
            deleted++;
        }

        return deleted;
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

        // Hide qualitative KPIs entirely when the org has them disabled.
        boolean qualitativeEnabled = organizationService.isQualitativeEnabled(organizationId);

        List<KpiCriteriaResponse> content = kpiPage.getContent().stream()
                .filter(kpi -> qualitativeEnabled || kpi.getKpiType() != com.kpitracking.enums.KpiType.QUALITATIVE)
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

                        // Bài bị trả lại (hoàn duyệt) còn hạn nộp lại: giao diện mở lại nút "Nộp bài"
                        // dù đợt đã hết hạn, và hiện lý do người chấm ghi.
                        Instant nowTs = Instant.now();
                        kpi.getSubmissions().stream()
                                .filter(s -> s.getDeletedAt() == null
                                        && s.getSubmittedBy().getId().equals(currentUser.getId())
                                        && s.isAwaitingResubmission(nowTs))
                                .min(java.util.Comparator.comparing(com.kpitracking.entity.KpiSubmission::getResubmitDeadline))
                                .ifPresent(s -> {
                                    response.setResubmitDeadline(s.getResubmitDeadline());
                                    response.setReturnReason(s.getReturnReason());
                                });

                        // Dấu vết lâu dài: KPI này đã từng bị trả lại bao nhiêu lần (kể cả khi đã nộp lại
                        // xong) và lý do của lần gần nhất — để còn biết KPI nào từng phải làm lại.
                        List<com.kpitracking.entity.KpiSubmission> returns = kpi.getSubmissions().stream()
                                .filter(s -> s.getDeletedAt() == null
                                        && s.getSubmittedBy().getId().equals(currentUser.getId())
                                        && s.getStatus() == com.kpitracking.enums.SubmissionStatus.RETURNED)
                                .toList();
                        response.setReturnCount(returns.size());
                        returns.stream()
                                .filter(s -> s.getReturnedAt() != null)
                                .max(java.util.Comparator.comparing(com.kpitracking.entity.KpiSubmission::getReturnedAt))
                                .ifPresent(s -> {
                                    response.setLastReturnReason(s.getReturnReason());
                                    response.setLastReturnedAt(s.getReturnedAt());
                                });
                    }
                    return response;
                })
                .toList();
        approvalView.enrichCriteria(content, currentUser.getId());
        collabEnricher.enrich(content, currentUser.getId());

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
    /**
     * Tổng trọng số của đơn vị theo bộ trạng thái mặc định — chính con số mà lúc gửi duyệt đem so
     * với 100%. Có lối vào này để nơi khác không phải biết `WEIGHT_COUNTED_STATUSES` là gì, và
     * nhất là để không ai chép lại công thức: cộng thô mọi trọng số trong đơn vị cho ra kết quả
     * NGƯỢC hẳn (đo thật: một chi nhánh ra 200% trong khi luật thật là 70%).
     */
    public Double calculateTotalWeightByOrgUnit(UUID orgUnitId, UUID kpiPeriodId) {
        return calculateTotalWeightByOrgUnit(orgUnitId, kpiPeriodId, WEIGHT_COUNTED_STATUSES);
    }

    public Double calculateTotalWeightByOrgUnit(UUID orgUnitId, UUID kpiPeriodId, List<KpiStatus> statuses) {
        return totalWeightOfUnit(kpiCriteriaRepository.findByOrgUnitIdAndKpiPeriodIdAndStatusIn(orgUnitId, kpiPeriodId, statuses));
    }

    /** Công thức tổng trọng số đơn vị trên một danh sách đã lọc sẵn: KPI chưa giao + người CAO NHẤT. */
    private double totalWeightOfUnit(List<KpiCriteria> kpis) {
        Double unassignedWeight = 0.0;
        Map<UUID, Double> userWeights = new HashMap<>();

        for (KpiCriteria kpi : kpis) {
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue; // Bonus KPIs don't count toward the 100% requirement
            if (hasDecompositionChildren(kpi)) continue; // Parent is just a grouping label; its children carry the real weight

            double weight = effectiveWeight(kpi); // trọng số THẬT = form × %hạng_mục (nếu có BSC + bộ tiêu chí)
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

    /**
     * Trọng số THẬT của 1 KPI = form × (%hạng_mục / 100), với %hạng_mục lấy từ bộ tiêu chí áp dụng cho
     * đơn vị của KPI (resolve đơn vị → cha → mặc định). Không bật BSC / chưa gán hạng mục / chưa có bộ tiêu chí
     * ⇒ giữ nguyên trọng số form (mô hình cũ). Hạng mục KHÔNG có trong bộ tiêu chí ⇒ 0 (không tính).
     */
    private double effectiveWeight(KpiCriteria kpi) {
        double raw = kpi.getWeight() != null ? kpi.getWeight() : 0.0;
        if (kpi.getKpiPeriod() == null) return raw;
        Organization org = kpi.getKpiPeriod().getOrganization();
        if (org == null || !Boolean.TRUE.equals(org.getEnableBsc())) return raw;
        com.kpitracking.entity.BscPerspective persp = com.kpitracking.util.BscPerspectiveResolver.effectivePerspective(kpi);
        if (persp == null) return raw;
        com.kpitracking.entity.BscScorecard sc = bscScoringService.resolveScorecard(kpi.getOrgUnit(), org.getId(), kpi.getKpiPeriod().getId());
        if (sc == null) return raw;
        Double pct = null;
        if (sc.getScorecardPerspectives() != null) {
            for (com.kpitracking.entity.BscScorecardPerspective sp : sc.getScorecardPerspectives()) {
                if (sp.getPerspective() != null && sp.getPerspective().getId().equals(persp.getId())) {
                    pct = sp.getWeightPercentage();
                    break;
                }
            }
        }
        if (pct == null) return 0.0; // hạng mục không nằm trong bộ tiêu chí đơn vị ⇒ không tính
        return raw * pct / 100.0;
    }

    /** Tổng trọng số THẬT cho các KPI của MỘT người (bỏ KPI thưởng + KPI cha decomposition). */
    private double sumEffectiveForUser(List<KpiCriteria> kpis, UUID userId) {
        double sum = 0.0;
        for (KpiCriteria kpi : kpis) {
            if (Boolean.TRUE.equals(kpi.getIsBonusKpi())) continue;
            if (hasDecompositionChildren(kpi)) continue;
            if (userId != null && (kpi.getAssignees() == null
                    || kpi.getAssignees().stream().noneMatch(a -> a.getId().equals(userId)))) continue;
            sum += effectiveWeight(kpi);
        }
        return sum;
    }

    @Transactional(readOnly = true)
    public Double getTotalWeight(UUID orgUnitId, UUID userId, UUID kpiPeriodId) {
        User currentUser = getCurrentUser();

        if (userId != null) {
            // Permission check: can only see other user's weight if has KPI:VIEW for their org unit
            // or if it's the current user themselves
            if (!currentUser.getId().equals(userId)) {
                User targetUser = userRepository.findById(userId)
                        .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", userId));
                
                // Simplified: if they have any permission in any of the target user's units
                boolean hasPermission = false;
                List<UserRoleOrgUnit> assignments = userRoleOrgUnitRepository.findByUserId(targetUser.getId());
                for (UserRoleOrgUnit assignment : assignments) {
                    if (permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", assignment.getOrgUnit().getId())) {
                        hasPermission = true;
                        break;
                    }
                }
                
                if (!hasPermission && !permissionChecker.isGlobalAdminOverUser(currentUser.getId(), targetUser.getId())) {
                    throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_USER_WEIGHT_INFORMATION);
                }
            }
            // Tổng theo TRỌNG SỐ THẬT (form × %hạng_mục). Cần load KPI để nhân %hạng_mục (SQL SUM không làm được).
            if (kpiPeriodId == null) {
                // Không có kỳ ⇒ không có %hạng_mục để nhân ⇒ giữ tổng thô như cũ.
                return kpiCriteriaRepository.sumWeightByUserIdAndKpiPeriodIdAndStatusIn(userId, null, WEIGHT_COUNTED_STATUSES);
            }
            List<KpiCriteria> userKpis;
            if (orgUnitId != null) {
                userKpis = kpiCriteriaRepository.findByOrgUnitIdAndKpiPeriodIdAndStatusIn(orgUnitId, kpiPeriodId, WEIGHT_COUNTED_STATUSES);
            } else {
                userKpis = kpiCriteriaRepository.findByUserIdInAssigneesAndKpiPeriodId(
                        userId, kpiPeriodId, WEIGHT_COUNTED_STATUSES, org.springframework.data.domain.Pageable.unpaged()).getContent();
            }
            return sumEffectiveForUser(userKpis, userId);
        }

        if (orgUnitId != null) {
            if (!permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:VIEW", orgUnitId)) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_UNIT_WEIGHT_INFORMATION);
            }

            return calculateTotalWeightByOrgUnit(orgUnitId, kpiPeriodId, WEIGHT_COUNTED_STATUSES);
        }
        
        return 0.0;
    }

    @Transactional
    public ImportKpiResponse importKpis(MultipartFile file, UUID kpiPeriodId, UUID orgUnitId, com.kpitracking.enums.KpiType kpiType) {
        final com.kpitracking.enums.KpiType importKpiType = kpiType != null ? kpiType : com.kpitracking.enums.KpiType.QUANTITATIVE;
        User currentUser = getCurrentUser();
        // Track modified user-period-orgunit triplets to validate weight after import
        java.util.Set<String> affectedUserPairs = new java.util.HashSet<>();
        com.kpitracking.entity.KpiPeriod kpiPeriod = kpiPeriodId != null ? 
                kpiPeriodRepository.findById(kpiPeriodId).orElse(null) : null;
        cycleStatusGuard.assertWritable(kpiPeriod);
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
            throw new BusinessException(ErrorCode.ONLY_3);
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
                                record.isMapped("TargetValue") ? record.get("TargetValue") : null,
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
                                record.isMapped("Perspective") ? record.get("Perspective") : null,
                                kpiPeriod, orgUnit, currentUser, affectedUserPairs, userOrgId, importKpiType);
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add(ErrorMessages.text("import.rowError", "", totalRows, e.getMessage()));
                        }
                    }
                }
            } else {
                try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
                    Sheet sheet = workbook.getSheetAt(0);
                    Row headerRow = sheet.getRow(0);
                    if (headerRow == null) throw new BusinessException(ErrorCode.EXCEL_FILE_EMPTY_2);

                    int nameIdx = -1, descIdx = -1, weightIdx = -1, targetIdx = -1, minIdx = -1, unitIdx = -1, freqIdx = -1, codeIdx = -1, namePeriodIdx = -1, nameOrgIdx = -1, krCodeIdx = -1, isReverseKpiIdx = -1, isBonusKpiIdx = -1, deadlineIdx = -1, perspectiveIdx = -1;
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
                        else if (header.equalsIgnoreCase("Perspective")) perspectiveIdx = i;
                    }

                    boolean requiresTarget = importKpiType != com.kpitracking.enums.KpiType.QUALITATIVE;
                    if (nameIdx == -1 || weightIdx == -1 || freqIdx == -1 || codeIdx == -1 || (requiresTarget && targetIdx == -1)) {
                        throw new BusinessException(ErrorCode.REQUIRED_COLUMNS_MISSING_EXCEL_FILE);
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
                                perspectiveIdx != -1 ? getCellValueAsString(row.getCell(perspectiveIdx)) : null,
                                kpiPeriod, orgUnit, currentUser, affectedUserPairs, userOrgId, importKpiType
                            );
                            successfulImports++;
                        } catch (Exception e) {
                            errors.add(ErrorMessages.text("import.rowError", "", totalRows, e.getMessage()));
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.FILE_PROCESSING_ERROR, e.getMessage());
        }

        if (!errors.isEmpty()) {
            String errorMsg = errors.stream().limit(5).collect(java.util.stream.Collectors.joining("\n"));
            if (errors.size() > 5) {
                errorMsg += "\n" + ErrorMessages.text("import.moreErrors", "", errors.size() - 5);
            }
            throw new BusinessException(ErrorCode.DATA_ERRORS_FILE_ROWS, String.valueOf(errorMsg));
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

            Double totalWeight = kpiCriteriaRepository.sumWeightByUserIdAndOrgUnitIdAndKpiPeriodIdAndStatusIn(uId, ouId, pId, WEIGHT_COUNTED_STATUSES);

            if (totalWeight == null || Math.abs(totalWeight - 100.0) > 0.001) {
                throw new BusinessException(ErrorCode.IMPORT_ERROR, String.valueOf((user != null ? user.getFullName() : uId)), String.valueOf((unit != null ? unit.getName() : ouId)), String.valueOf(periodName), String.valueOf((totalWeight != null ? totalWeight : 0)));
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
                              String perspectiveCode,
                              com.kpitracking.entity.KpiPeriod defaultPeriod, OrgUnit defaultUnit, User creator,
                              java.util.Set<String> affectedUserPairs, UUID organizationId, com.kpitracking.enums.KpiType kpiType) {
        boolean isQualitative = kpiType == com.kpitracking.enums.KpiType.QUALITATIVE;
        if (name == null || name.isBlank()) throw new BusinessException(ErrorCode.KPI_NAME_REQUIRED);
        if (weight == null || weight.isBlank()) throw new BusinessException(ErrorCode.WEIGHT_REQUIRED);
        // Qualitative KPIs have no numeric target.
        if (!isQualitative && (target == null || target.isBlank())) throw new BusinessException(ErrorCode.TARGET_REQUIRED);

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
            throw new BusinessException(ErrorCode.CHOOSE_KPI_PERIOD_PROVIDE_PERIOD_NAME_EXCEL);
        }
        cycleStatusGuard.assertWritable(finalPeriod);

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
                throw new BusinessException(ErrorCode.CHOOSE_UNIT_PROVIDE_UNIT_NAME_EXCEL_FILE);
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
                        .orElseThrow(() -> new BusinessException(ErrorCode.NO_EMPLOYEE_FOUND_CODE, String.valueOf(trimmedCode)));
                assignees.add(user);
            }
        }
        if (assignees.isEmpty()) throw new BusinessException(ErrorCode.PROVIDE_LEAST_ONE_EMPLOYEE_CODE_ASSIGN_KPI);

        KpiFrequency frequency;
        try {
            frequency = KpiFrequency.valueOf(freq.toUpperCase());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.FREQUENCY_INVALID, String.valueOf(freq));
        }

        // Validate frequency compatibility with period
        if (finalPeriod.getPeriodType() != null) {
            if (frequency.ordinal() > finalPeriod.getPeriodType().ordinal()) {
                throw new BusinessException(ErrorCode.FREQUENCY_DOES_NOT_FIT_PERIOD_TYPE, String.valueOf(freq), String.valueOf(finalPeriod.getPeriodType()));
            }
        }

        double weightVal;
        Double targetVal;
        try {
            weightVal = Double.parseDouble(weight);
            targetVal = isQualitative ? null : Double.parseDouble(target);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.WEIGHT_TARGET_MUST_NUMBERS);
        }

        Double minVal = !isQualitative && min != null && !min.isBlank() ? Double.parseDouble(min) : null;
        if (!isQualitative) {
            validateReverseKpiThreshold(parseBoolean(isReverseKpiStr), targetVal, minVal, name);
        }

        // Create one KpiCriteria per resolved org unit
        for (OrgUnit finalUnit : finalUnits) {
            if (!permissionChecker.hasPermissionInOrgUnit(creator.getId(), "KPI:CREATE", finalUnit.getId())) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_CREATE_KPIS_UNIT_2, finalUnit.getName());
            }

            validateWaterfallAssignment(creator, finalUnit, assignees);

            KpiStatus importedStatus = initialCriteriaStatus(organizationId, creator);

            KpiCriteria kpi = KpiCriteria.builder()
                    .kpiType(kpiType != null ? kpiType : com.kpitracking.enums.KpiType.QUANTITATIVE)
                    .name(name)
                    .description(desc)
                    .weight(weightVal)
                    .targetValue(targetVal)
                    .minimumValue(minVal)
                    .isReverseKpi(!isQualitative && parseBoolean(isReverseKpiStr))
                    .isBonusKpi(parseBoolean(isBonusKpiStr))
                    .deadline(deadlineVal)
                    .unit(isQualitative ? null : unit)
                    .frequency(frequency)
                    .assignees(assignees)
                    .orgUnit(finalUnit)
                    .kpiPeriod(finalPeriod)
                    .createdBy(creator)
                    .status(importedStatus)
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
                            throw new BusinessException(ErrorCode.OKR_LINK_ERROR, finalUnit.getName(), String.valueOf(unitNames));
                        }
                    }
                    kpi.setKeyResult(kr);
                }
            }

            if (perspectiveCode != null && !perspectiveCode.isBlank() && organizationId != null) {
                String pc = perspectiveCode.trim();
                bscPerspectiveRepository.findFirstByOrganizationIdAndCodeIgnoreCase(organizationId, pc)
                        .or(() -> bscPerspectiveRepository.findFirstByOrganizationIdAndNameIgnoreCase(organizationId, pc))
                        .ifPresent(kpi::setPerspective);
            }

            if (kpi.getStatus() == KpiStatus.APPROVED) {
                kpi.setApprovedBy(creator);
                kpi.setApprovedAt(Instant.now());
            }

            requirePerspectiveWhenBscEnabled(kpi, "when.beforeImport");
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
                    throw new BusinessException(ErrorCode.WATERFALL_MODE_KPIS_CAN_ONLY_ASSIGNED_UNIT, assignee.getFullName(), orgUnit.getName());
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

        throw new BusinessException(ErrorCode.DEADLINE_INVALID_FORMAT, String.valueOf(raw));
    }

    @Transactional
    public KpiCriteriaResponse replaceKpiCriteria(UUID replacedKpiId, com.kpitracking.dto.request.kpi.ReplaceKpiRequest request) {
        User currentUser = getCurrentUser();

        KpiCriteria replacedKpi = kpiCriteriaRepository.findById(replacedKpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", replacedKpiId));
        cycleStatusGuard.assertWritable(replacedKpi);

        boolean isCreator = replacedKpi.getCreatedBy().getId().equals(currentUser.getId());
        boolean canUpdate = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:UPDATE", replacedKpi.getOrgUnit().getId());
        if (!isCreator && !canUpdate) {
            throw new ForbiddenException(ErrorCode.NO_PERMISSION_REPLACE_KPI);
        }

        if (replacedKpi.getStatus() == KpiStatus.REPLACED || replacedKpi.getStatus() == KpiStatus.INACTIVE) {
            throw new BusinessException(ErrorCode.KPI_REPLACED_NO_LONGER_ACTIVE);
        }
        if (hasPendingReplacement(replacedKpi)) {
            throw new BusinessException(ErrorCode.KPI_REPLACEMENT_PENDING_APPROVAL, replacedKpi.getReplacedBy().getName());
        }

        Double newWeight = request.getWeight() != null ? request.getWeight() : replacedKpi.getWeight();

        List<User> newAssignees;
        if (request.getAssignedToIds() != null && !request.getAssignedToIds().isEmpty()) {
            newAssignees = new ArrayList<>();
            for (UUID id : request.getAssignedToIds()) {
                newAssignees.add(userRepository.findById(id)
                        .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", id)));
            }
        } else {
            newAssignees = new ArrayList<>(replacedKpi.getAssignees());
        }

        // Cùng luật với tạo mới (tắt bước duyệt ⇒ APPROVED, tự duyệt ⇒ APPROVED, còn lại DRAFT).
        // Riêng khi KPI bị thay đã VÀO luồng duyệt (đã gửi / đã duyệt) mà người thay không tự duyệt
        // được, bản thay thế phải đi thẳng vào CHỜ DUYỆT: đo thật cho thấy để nó nằm nháp thì
        // không ai gửi tiếp, chốt 100% lúc gửi duyệt đã qua từ trước, và sang kỳ chấm người đó chỉ
        // còn 80% trọng số đã duyệt.
        KpiStatus initialStatus = initialCriteriaStatus(organizationIdOf(replacedKpi), currentUser);
        if (initialStatus == KpiStatus.DRAFT && IN_APPROVAL_PIPELINE_STATUSES.contains(replacedKpi.getStatus())) {
            initialStatus = KpiStatus.PENDING_APPROVAL;
        }

        com.kpitracking.enums.KpiType newKpiType = request.getKpiType() != null
                ? request.getKpiType() : com.kpitracking.enums.KpiType.QUANTITATIVE;
        boolean isQualitative = newKpiType == com.kpitracking.enums.KpiType.QUALITATIVE;

        if (!isQualitative) {
            validateReverseKpiThreshold(Boolean.TRUE.equals(request.getIsReverseKpi()),
                    request.getTargetValue(), request.getMinimumValue(), request.getName());
        }

        KpiCriteria newKpi = KpiCriteria.builder()
                .orgUnit(replacedKpi.getOrgUnit())
                .assignees(newAssignees)
                .kpiType(newKpiType)
                .name(request.getName())
                .description(request.getDescription())
                .weight(newWeight)
                // Qualitative KPIs have no numeric measurement fields.
                .targetValue(isQualitative ? null : request.getTargetValue())
                .minimumValue(isQualitative ? null : request.getMinimumValue())
                .isReverseKpi(!isQualitative && Boolean.TRUE.equals(request.getIsReverseKpi()))
                .isBonusKpi(Boolean.TRUE.equals(request.getIsBonusKpi()))
                .unit(isQualitative ? null : request.getUnit())
                .deadline(request.getDeadline())
                .frequency(request.getFrequency())
                .status(initialStatus)
                .createdBy(currentUser)
                .kpiPeriod(replacedKpi.getKpiPeriod())
                .build();

        if (request.getKeyResultId() != null) {
            com.kpitracking.entity.KeyResult kr = keyResultRepository.findById(request.getKeyResultId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.keyResult"), "id", request.getKeyResultId()));
            newKpi.setKeyResult(kr);
        }

        if (request.getPerspectiveId() != null) {
            com.kpitracking.entity.BscPerspective perspective = bscPerspectiveRepository.findById(request.getPerspectiveId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.bscItem"), "id", request.getPerspectiveId()));
            newKpi.setPerspective(perspective);
        }

        if (initialStatus == KpiStatus.APPROVED) {
            newKpi.setApprovedBy(currentUser);
            newKpi.setApprovedAt(Instant.now());
        } else if (initialStatus == KpiStatus.PENDING_APPROVAL) {
            newKpi.setSubmittedAt(Instant.now());
        }

        requirePerspectiveWhenBscEnabled(newKpi, "when.beforeReplace");
        newKpi = kpiCriteriaRepository.save(newKpi);

        boolean chain = approvalChain.isChainMode(replacedKpi);
        if (chain && initialStatus == KpiStatus.PENDING_APPROVAL) {
            // Bản thay thế đi đúng chuỗi duyệt và luật duyệt cuối như một chỉ tiêu mới.
            var started = approvalChain.startCriteria(newKpi, currentUser,
                    com.kpitracking.enums.ApprovalEventAction.SUBMITTED, true);
            if (started.selfApproved()) {
                initialStatus = KpiStatus.APPROVED;
                newKpi.setStatus(KpiStatus.APPROVED);
                newKpi.setApprovedBy(currentUser);
                newKpi.setApprovedAt(Instant.now());
                newKpi = kpiCriteriaRepository.save(newKpi);
            }
        }

        // C8b: KPI cũ đang chạy (đã duyệt / đã điều chỉnh) chỉ thành REPLACED khi bản thay được
        // duyệt cuối (completeReplacementOf). KPI cũ chưa chạy (nháp, bị từ chối, đang chờ) thì
        // không có gì để mất, thay ngay như trước.
        boolean deferReplace = chain && initialStatus != KpiStatus.APPROVED
                && (replacedKpi.getStatus() == KpiStatus.APPROVED || replacedKpi.getStatus() == KpiStatus.EDITED);
        replacedKpi.setReplacedBy(newKpi);
        replacedKpi.setReplacementReason(request.getReplacementReason());
        if (!deferReplace) {
            replacedKpi.setStatus(KpiStatus.REPLACED);
            approvalChain.cancelRunning(List.of(replacedKpi.getId()), currentUser,
                    LocalizedText.of("approvalEvent.reason.replaced", newKpi.getName()));
        }
        kpiCriteriaRepository.save(replacedKpi);
        if (!deferReplace) collabHooks.onReplaced(replacedKpi, newKpi);

        if (initialStatus == KpiStatus.APPROVED) {
            eventPublisher.publishEvent(new KpiCriteriaApprovedEvent(this, newKpi));
        } else if (initialStatus == KpiStatus.PENDING_APPROVAL) {
            eventPublisher.publishEvent(new KpiCriteriaSubmittedForApprovalEvent(this, newKpi));
        }

        return kpiCriteriaMapper.toResponse(newKpi);
    }

    @Transactional
    public List<KpiCriteriaResponse> batchUpdateWeights(com.kpitracking.dto.request.kpi.BatchUpdateWeightRequest request) {
        User currentUser = getCurrentUser();
        List<KpiCriteria> updated = new ArrayList<>();
        Map<String, KpiCriteria> grownUnits = new java.util.LinkedHashMap<>();

        for (com.kpitracking.dto.request.kpi.WeightUpdateItem item : request.getUpdates()) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(item.getKpiId())
                    .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", item.getKpiId()));
            cycleStatusGuard.assertWritable(kpi);

            boolean isCreator = kpi.getCreatedBy().getId().equals(currentUser.getId());
            boolean canUpdate = permissionChecker.hasPermissionInOrgUnit(currentUser.getId(), "KPI:UPDATE", kpi.getOrgUnit().getId());
            if (!isCreator && !canUpdate) {
                throw new ForbiddenException(ErrorCode.NO_PERMISSION_EDIT_WEIGHT_KPI, kpi.getName());
            }

            if (kpi.getStatus() == KpiStatus.REPLACED || kpi.getStatus() == KpiStatus.INACTIVE) {
                throw new BusinessException(ErrorCode.CANNOT_CHANGE_WEIGHT_KPI_REPLACED_DEACTIVATED, kpi.getName());
            }

            boolean grew = item.getWeight() != null && item.getWeight() > (kpi.getWeight() != null ? kpi.getWeight() : 0.0) + 0.001;
            kpi.setWeight(item.getWeight());
            updated.add(kpiCriteriaRepository.save(kpi));
            if (grew && COMMITTED_WITHOUT_APPROVAL.contains(kpi.getStatus())
                    && kpi.getOrgUnit() != null && kpi.getKpiPeriod() != null) {
                grownUnits.putIfAbsent(kpi.getOrgUnit().getId() + ":" + kpi.getKpiPeriod().getId(), kpi);
            }
        }

        // Chốt sau khi áp CẢ lô: lô thường vừa tăng chỉ tiêu này vừa giảm chỉ tiêu khác cho đủ 100%, xét từng
        // dòng một thì dòng tăng đứng trước sẽ bị chặn oan. Vượt thì ném lỗi, giao dịch cuộn lại toàn bộ.
        for (KpiCriteria sample : grownUnits.values()) {
            double total = usedWeightInUnit(sample.getOrgUnit().getId(), sample.getKpiPeriod().getId(), List.of(), null);
            if (total > 100.0 + 0.001) {
                throw new BusinessException(ErrorCode.APPROVED_KPI_WEIGHTS_EXCEED_FULL_WEIGHT,
                        sample.getOrgUnit().getName(), sample.getKpiPeriod().getName(), formatWeight(total));
            }
        }

        return updated.stream().map(kpiCriteriaMapper::toResponse).toList();
    }
}
