package com.kpitracking.service.kpi.approval;

import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.ApprovalChainEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import com.kpitracking.workflow.WorkflowStage;
import com.kpitracking.workflow.def.StageConfig;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Chuỗi duyệt KPI theo phân cấp — phần GHI.
 *
 * <p>Service này chỉ quản bảng chuỗi duyệt (flow / bước / lịch sử). Việc đổi trạng thái KPI hay
 * yêu cầu điều chỉnh vẫn nằm ở {@code KpiCriteriaService} / {@code KpiAdjustmentService}: chúng hỏi
 * {@link #authorize} xem người bấm có giữ bước không và bấm là "duyệt cuối" hay "chuyển lên", rồi
 * tự chạy các ràng buộc nghiệp vụ của mình trước khi gọi {@link #approve}.
 *
 * <p>Thứ tự khoá: kỳ ({@code FOR SHARE}, qua {@link CycleStatusGuard}) TRƯỚC, flow
 * ({@code FOR UPDATE}) SAU — cùng thứ tự với thủ tục khoá kỳ nên không thể deadlock với nó.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KpiApprovalChainService {

    public static final String MODE_CHAIN = "CHAIN";
    public static final String PERM_FINAL = "KPI:APPROVE_FINAL";
    public static final String PERM_CRITERIA = "KPI:APPROVE_CRITERIA";
    public static final String PERM_ADJUSTMENT = "KPI:APPROVE_ADJUSTMENT";
    public static final int DEFAULT_REMINDER_DAYS = 3;

    private final KpiApprovalFlowRepository flowRepository;
    private final KpiApprovalEventRepository eventRepository;
    private final com.kpitracking.service.discussion.KpiDiscussionTimeline discussionTimeline;
    private final KpiApprovalStepRepository stepRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final UserRepository userRepository;
    private final PermissionChecker permissionChecker;
    private final KpiWorkflowConfigService workflowConfigService;
    private final CycleStatusGuard cycleStatusGuard;
    private final ApplicationEventPublisher eventPublisher;
    private final EntityManager entityManager;

    // ── Cấu hình ─────────────────────────────────────────────────────────────

    private StageConfig approvalStage(UUID organizationId) {
        return workflowConfigService.definitionFor(organizationId).stageConfig(WorkflowStage.CRITERIA_APPROVAL);
    }

    /** Tổ chức đang dùng chuỗi duyệt (mặc định) hay luồng một cấp cũ ({@code UNIT_HEAD}). */
    public boolean isChainMode(UUID organizationId) {
        if (organizationId == null) return false;
        return MODE_CHAIN.equals(approvalStage(organizationId).stringOption("approverMode", MODE_CHAIN));
    }

    public boolean isChainMode(KpiCriteria kpi) {
        return isChainMode(PermissionChecker.organizationIdOf(kpi.getOrgUnit()));
    }

    /** Bước chờ quá bao nhiêu ngày thì nhắc người giữ bước. */
    public int reminderDays(UUID organizationId) {
        int days = approvalStage(organizationId).intOption("reminderAfterDays", DEFAULT_REMINDER_DAYS);
        return days < 1 ? DEFAULT_REMINDER_DAYS : days;
    }

    // ── Kết quả trả về cho phía gọi ─────────────────────────────────────────

    /** {@code selfApproved}: chuỗi rỗng và người gửi được tự duyệt (C3) — phía gọi chốt ngay. */
    public record StartResult(KpiApprovalFlow flow, boolean selfApproved) {}

    /**
     * Người bấm giữ bước hiện tại. {@code finalApproval}: bấm duyệt sẽ chốt luôn;
     * {@code delegated}: chốt nhờ quyền duyệt cuối nên còn bước phía trên bị bỏ qua.
     */
    public record Decision(KpiApprovalFlow flow, KpiApprovalStep step, boolean finalApproval, boolean delegated) {}

    // ── Lập chuỗi ───────────────────────────────────────────────────────────

    /**
     * Mở flow mới cho chỉ tiêu vừa gửi duyệt.
     *
     * @param action {@code SUBMITTED}, hoặc {@code MIGRATED} khi chuyển KPI đang chờ theo luồng cũ
     * @param notify {@code false} khi chuyển đổi hàng loạt — không rải thông báo
     */
    @Transactional
    public StartResult startCriteria(KpiCriteria kpi, User requester, ApprovalEventAction action, boolean notify) {
        return start(ApprovalSubjectType.CRITERIA, kpi, null, requester, action, notify);
    }

    @Transactional
    public StartResult startAdjustment(KpiAdjustmentRequest adjustment, User requester,
                                       ApprovalEventAction action, boolean notify) {
        return start(ApprovalSubjectType.ADJUSTMENT, adjustment.getKpiCriteria(), adjustment, requester, action, notify);
    }

    private StartResult start(ApprovalSubjectType type, KpiCriteria kpi, KpiAdjustmentRequest adjustment,
                              User requester, ApprovalEventAction action, boolean notify) {
        UUID orgId = PermissionChecker.organizationIdOf(kpi.getOrgUnit());
        // Mỗi đối tượng một flow đang chạy: bản cũ (nếu có) dừng lại trước khi mở bản mới.
        if (type == ApprovalSubjectType.CRITERIA) {
            flowRepository.findRunningId(kpi.getId(), type).ifPresent(id -> finish(lockFlow(id),
                    ApprovalFlowStatus.CANCELLED, ApprovalEventAction.CANCELLED, requester, LocalizedText.of("approvalEvent.reason.resubmitted")));
        } else {
            flowRepository.findRunningIdByAdjustment(adjustment.getId()).ifPresent(id -> finish(lockFlow(id),
                    ApprovalFlowStatus.CANCELLED, ApprovalEventAction.CANCELLED, requester, LocalizedText.of("approvalEvent.reason.requestResubmitted")));
        }

        String permission = type == ApprovalSubjectType.CRITERIA ? PERM_CRITERIA : PERM_ADJUSTMENT;
        ApprovalChainPlanner.Plan plan = ApprovalChainPlanner.plan(requester.getId(), pathOf(kpi.getOrgUnit(), permission));

        long previous = type == ApprovalSubjectType.CRITERIA
                ? flowRepository.countByKpiCriteriaIdAndSubjectType(kpi.getId(), type)
                : flowRepository.countByAdjustmentRequestId(adjustment.getId());

        KpiApprovalFlow flow = KpiApprovalFlow.builder()
                .organizationId(orgId)
                .subjectType(type)
                .kpiCriteria(kpi)
                .adjustmentRequest(adjustment)
                .requester(requester)
                .round((int) previous + 1)
                .build();

        int order = 0;
        for (ApprovalChainPlanner.PlannedStep p : plan.steps()) {
            flow.getSteps().add(KpiApprovalStep.builder()
                    .flow(flow)
                    .stepOrder(++order)
                    .kind(ApprovalStepKind.UNIT_HEAD)
                    .orgUnitId(p.unitId())
                    .orgUnitName(p.unitName())
                    .mergedUnits(p.mergedUnits().isEmpty() ? null : p.mergedUnits().stream()
                            .map(u -> Map.<String, Object>of("id", u.unitId().toString(), "name", u.unitName()))
                            .toList())
                    .status(p.actionable() ? ApprovalStepStatus.WAITING : ApprovalStepStatus.SKIPPED_NO_HEAD)
                    .skipReason(p.skipReason() == null ? null
                            : LocalizedText.of(p.skipReason()).render(SupportedLanguages.DEFAULT_LOCALE))
                    .skipReasonI18n(p.skipReason() == null ? null : LocalizedText.of(p.skipReason()).toJson())
                    .approvers(new ArrayList<>(p.approvers().stream()
                            .map(h -> new KpiApprovalStep.StepApprover(h.userId(), h.name())).toList()))
                    .build());
        }

        Map<String, Object> submitDetail = new LinkedHashMap<>();

        // Người có KPI:APPROVE_OWN không đi chuỗi duyệt: chỉ tiêu của họ chốt ngay (giữ đúng hành vi
        // trước khi có chuỗi). Điều chỉnh thì luôn đi chuỗi. Chuyển đổi KPI cũ (MIGRATED) không tự chốt.
        boolean allowSelfApprove = approvalStage(orgId).booleanOption("allowSelfApprove", true);
        boolean selfApproved = type == ApprovalSubjectType.CRITERIA && action != ApprovalEventAction.MIGRATED
                && allowSelfApprove && permissionChecker.hasPermission(requester.getId(), "KPI:APPROVE_OWN");
        if (selfApproved) {
            flow.getSteps().clear();
        }

        if (!selfApproved && !plan.hasActionableStep()) {
            // C3: không còn ai phía trên người gửi ⇒ chuyển admin tổ chức.
            List<User> admins = adminsOf(orgId, requester.getId());
            if (admins.isEmpty()) {
                throw new BusinessException(ErrorCode.NO_APPROVER_FOUND, kpi.getName());
            }
            OrgUnit root = rootOf(kpi.getOrgUnit());
            flow.getSteps().add(KpiApprovalStep.builder()
                    .flow(flow)
                    .stepOrder(++order)
                    .kind(ApprovalStepKind.ADMIN_FALLBACK)
                    .orgUnitId(root.getId())
                    .orgUnitName(root.getName())
                    .status(ApprovalStepStatus.WAITING)
                    .approvers(new ArrayList<>(admins.stream()
                            .map(u -> new KpiApprovalStep.StepApprover(u.getId(), u.getFullName())).toList()))
                    .build());
            submitDetail.put("adminFallback", true);
        }

        Instant now = Instant.now();
        if (selfApproved) {
            flow.setStatus(ApprovalFlowStatus.APPROVED);
            flow.setFinishedAt(now);
        } else {
            KpiApprovalStep first = flow.nextWaitingAfter(0).orElseThrow();
            first.setStatus(ApprovalStepStatus.PENDING);
            first.setPendingSince(now);
            flow.setCurrentStepOrder(first.getStepOrder());
        }
        flow = flowRepository.save(flow);

        record(flow, null, action, requester, (String) null, submitDetail.isEmpty() ? null : submitDetail);
        for (KpiApprovalStep s : flow.getSteps()) {
            if (s.getStatus() == ApprovalStepStatus.SKIPPED_NO_HEAD) {
                record(flow, s, ApprovalEventAction.SKIPPED_NO_HEAD, null, s.getSkipReason(),
                        Map.of("unitName", nullToEmpty(s.getOrgUnitName())));
            }
        }
        if (selfApproved) {
            record(flow, null, ApprovalEventAction.SELF_APPROVED_TOP, requester,
                    LocalizedText.of("approvalEvent.reason.selfApprovedTop"), null);
        } else if (notify) {
            flow.currentStep().ifPresent(s -> eventPublisher.publishEvent(new ApprovalChainEvents.StepAssigned(
                    flowIdOf(s), s.getId(), ApprovalChainEvents.StepAssigned.Kind.NEW)));
        }
        return new StartResult(flow, selfApproved);
    }

    /** Đường đi đơn vị của KPI lên gốc, kèm các trưởng (rank 0) của từng đơn vị. */
    private List<ApprovalChainPlanner.UnitHeads> pathOf(OrgUnit unit, String permission) {
        List<OrgUnit> units = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (OrgUnit u = unit; u != null && seen.add(u.getId()); u = u.getParent()) {
            if (u.getDeletedAt() == null) units.add(u);
        }

        Instant now = Instant.now();
        Map<UUID, List<UserRoleOrgUnit>> headsByUnit = new HashMap<>();
        Set<UUID> roleIds = new HashSet<>();
        for (OrgUnit u : units) {
            List<UserRoleOrgUnit> heads = userRoleOrgUnitRepository.findByOrgUnitIdAndRoleRank(u.getId(), 0).stream()
                    .filter(a -> a.getExpiresAt() == null || a.getExpiresAt().isAfter(now))
                    .filter(a -> a.getUser() != null && a.getUser().getDeletedAt() == null)
                    .filter(a -> a.getRole() != null && a.getRole().getDeletedAt() == null)
                    .toList();
            headsByUnit.put(u.getId(), heads);
            heads.forEach(a -> roleIds.add(a.getRole().getId()));
        }
        Map<UUID, Set<String>> permsByRole = new HashMap<>();
        if (!roleIds.isEmpty()) {
            for (RolePermission rp : rolePermissionRepository.findByRoleIdIn(roleIds)) {
                permsByRole.computeIfAbsent(rp.getRole().getId(), k -> new HashSet<>()).add(rp.getPermission().getCode());
            }
        }

        List<ApprovalChainPlanner.UnitHeads> path = new ArrayList<>();
        for (OrgUnit u : units) {
            Map<UUID, ApprovalChainPlanner.Head> byUser = new LinkedHashMap<>();
            for (UserRoleOrgUnit a : headsByUnit.get(u.getId())) {
                Set<String> perms = permsByRole.getOrDefault(a.getRole().getId(), Set.of());
                boolean canApprove = perms.contains(permission) || perms.contains("SYSTEM:ADMIN");
                User user = a.getUser();
                // Một người có thể giữ hai vai trò trưởng ở cùng đơn vị: gộp, có quyền ở một vai là đủ.
                byUser.merge(user.getId(),
                        new ApprovalChainPlanner.Head(user.getId(), user.getFullName(), !user.isPausedAccount(), canApprove),
                        (x, y) -> new ApprovalChainPlanner.Head(x.userId(), x.name(), x.active(), x.canApprove() || y.canApprove()));
            }
            path.add(new ApprovalChainPlanner.UnitHeads(u.getId(), u.getName(), new ArrayList<>(byUser.values())));
        }
        return path;
    }

    private OrgUnit rootOf(OrgUnit unit) {
        OrgUnit u = unit;
        Set<UUID> seen = new HashSet<>();
        while (u.getParent() != null && seen.add(u.getId())) u = u.getParent();
        return u;
    }

    /** Admin tổ chức = người có SYSTEM:ADMIN ở đơn vị gốc, còn hoạt động, khác người gửi. */
    private List<User> adminsOf(UUID orgId, UUID excludeUserId) {
        Map<UUID, User> out = new LinkedHashMap<>();
        for (OrgUnit root : orgUnitRepository.findRootsByOrganizationId(orgId)) {
            for (User u : userRoleOrgUnitRepository.findUsersWithPermissionInOrgUnit(root.getId(), "SYSTEM:ADMIN")) {
                if (u.getDeletedAt() == null && !u.isPausedAccount() && !u.getId().equals(excludeUserId)) {
                    out.putIfAbsent(u.getId(), u);
                }
            }
        }
        return new ArrayList<>(out.values());
    }

    // ── Duyệt / từ chối ────────────────────────────────────────────────────

    /** Id flow đang chạy của chỉ tiêu (không khoá). */
    public Optional<UUID> runningCriteriaFlowId(UUID kpiId) {
        return flowRepository.findRunningId(kpiId, ApprovalSubjectType.CRITERIA);
    }

    public Optional<UUID> runningAdjustmentFlowId(UUID adjustmentId) {
        return flowRepository.findRunningIdByAdjustment(adjustmentId);
    }

    /**
     * Khoá flow ({@code SELECT … FOR UPDATE}) NGAY LÚC NẠP. Người thứ hai bấm cùng lúc chờ ở đây,
     * rồi đọc trạng thái mới nhất sau khi người thứ nhất commit và nhận 409.
     *
     * <p>Phía gọi chỉ nên cầm id (không nạp flow trước) để lần nạp này là lần đầu trong phiên. Nếu
     * flow đã nằm sẵn trong phiên mà hàng trong DB đã đổi, Hibernate kiểm phiên bản và ném
     * {@code OptimisticLockException} — cũng quy về 409.
     */
    public KpiApprovalFlow lockFlow(UUID flowId) {
        KpiApprovalFlow flow;
        try {
            flow = entityManager.find(KpiApprovalFlow.class, flowId, LockModeType.PESSIMISTIC_WRITE);
        } catch (jakarta.persistence.OptimisticLockException e) {
            throw new StaleStateException(ErrorCode.APPROVAL_CHAIN_JUST_UPDATED_SOMEONE_ELSE_RELOAD);
        }
        if (flow == null) throw new StaleStateException(ErrorCode.APPROVAL_CHAIN_NO_LONGER_EXISTS_RELOAD);
        return flow;
    }

    /**
     * Kiểm người bấm có đang giữ bước hiện tại không, và bấm duyệt sẽ ra sao.
     *
     * <p>Admin KHÔNG được duyệt thay (quyết định C9) dù SYSTEM:ADMIN bao gồm mọi quyền — chỉ được
     * gán lại người duyệt. Admin chính là người giữ bước thì duyệt như mọi người khác.
     *
     * <p>Quyền duyệt cuối kiểm NGAY LÚC BẤM, theo vai trò hiện tại: admin vừa tắt quyền của vai trò
     * thì lần bấm này chỉ còn là "duyệt và chuyển lên".
     */
    public Decision authorize(UUID flowId, User actor, UUID expectedStepId) {
        KpiApprovalFlow flow = lockFlow(flowId);
        if (flow.getStatus().isTerminal()) {
            throw new StaleStateException(ErrorCode.APPROVAL_REQUEST_COMPLETED_RELOAD);
        }
        KpiApprovalStep step = flow.currentStep()
                .orElseThrow(() -> new StaleStateException(ErrorCode.APPROVAL_CHAIN_CHANGING_RELOAD));
        if (expectedStepId != null && !expectedStepId.equals(step.getId())) {
            throw new StaleStateException(ErrorCode.APPROVAL_STEP_CHANGED);
        }

        UUID unitId = flow.getKpiCriteria().getOrgUnit().getId();
        if (!step.isHeldBy(actor.getId())) {
            if (permissionChecker.isGlobalAdminIn(actor.getId(), unitId)) {
                throw new ForbiddenException(ErrorCode.ADMINISTRATORS_MAY_ONLY_REASSIGN_APPROVER_NOT_APPROVE, String.valueOf(step.approverNames()));
            }
            throw new ForbiddenException(ErrorCode.NOT_HOLDER_APPROVAL_STEP, String.valueOf(step.approverNames()));
        }
        if (flow.getRequester() != null && flow.getRequester().getId().equals(actor.getId())) {
            throw new ForbiddenException(ErrorCode.CANNOT_APPROVE_OWN_REQUEST);
        }

        boolean lastStep = flow.nextWaitingAfter(step.getStepOrder()).isEmpty();
        boolean hasFinal = step.getKind() == ApprovalStepKind.ADMIN_FALLBACK
                || permissionChecker.hasRolePermissionInOrgUnit(actor.getId(), PERM_FINAL, unitId);
        boolean isFinal = lastStep || hasFinal;
        return new Decision(flow, step, isFinal, isFinal && !lastStep);
    }

    /** Ghi quyết định duyệt. Phía gọi đã chạy xong ràng buộc nghiệp vụ nếu đây là duyệt cuối. */
    public ApprovalOutcome approve(Decision d, User actor, String comment) {
        KpiApprovalFlow flow = d.flow();
        KpiApprovalStep step = d.step();
        Instant now = Instant.now();
        step.setActedBy(actor);
        step.setActedAt(now);
        step.setReason(blankToNull(comment));

        if (d.finalApproval()) {
            step.setStatus(ApprovalStepStatus.APPROVED_FINAL);
            List<KpiApprovalStep> skipped = new ArrayList<>();
            for (KpiApprovalStep s : flow.getSteps()) {
                if (s.getStepOrder() > step.getStepOrder() && s.getStatus() == ApprovalStepStatus.WAITING) {
                    s.setStatus(ApprovalStepStatus.SKIPPED_DELEGATED);
                    LocalizedText skip = LocalizedText.of("approval.skip.finalApprovalBelow", actor.getFullName());
                    s.setSkipReason(skip.render(SupportedLanguages.DEFAULT_LOCALE));
                    s.setSkipReasonI18n(skip.toJson());
                    skipped.add(s);
                }
            }
            flow.setStatus(ApprovalFlowStatus.APPROVED);
            flow.setFinishedAt(now);
            flowRepository.save(flow);
            record(flow, step, ApprovalEventAction.APPROVED_FINAL, actor, comment,
                    Map.of("delegated", d.delegated()));
            for (KpiApprovalStep s : skipped) {
                record(flow, s, ApprovalEventAction.SKIPPED_DELEGATED, actor, s.getSkipReason(), null);
            }
            if (flow.getSubjectType() == ApprovalSubjectType.ADJUSTMENT) {
                eventPublisher.publishEvent(new ApprovalChainEvents.AdjustmentDecided(flow.getId()));
            }
            return ApprovalOutcome.FINAL;
        }

        step.setStatus(ApprovalStepStatus.APPROVED_FORWARDED);
        KpiApprovalStep next = flow.nextWaitingAfter(step.getStepOrder()).orElseThrow();
        next.setStatus(ApprovalStepStatus.PENDING);
        next.setPendingSince(now);
        flow.setCurrentStepOrder(next.getStepOrder());
        flowRepository.save(flow);
        record(flow, step, ApprovalEventAction.APPROVED_FORWARD, actor, comment,
                Map.of("nextHolders", next.approverNames(), "nextUnit", nullToEmpty(next.getOrgUnitName())));
        eventPublisher.publishEvent(new ApprovalChainEvents.StepAssigned(
                flow.getId(), next.getId(), ApprovalChainEvents.StepAssigned.Kind.FORWARDED));
        return ApprovalOutcome.FORWARDED;
    }

    /** Từ chối ở bất kỳ bước nào: flow kết thúc, đối tượng quay về người gửi. */
    public void reject(Decision d, User actor, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.ENTER_REJECTION_REASON);
        }
        KpiApprovalFlow flow = d.flow();
        KpiApprovalStep step = d.step();
        Instant now = Instant.now();
        step.setStatus(ApprovalStepStatus.REJECTED);
        step.setActedBy(actor);
        step.setActedAt(now);
        step.setReason(reason);
        flow.getSteps().stream()
                .filter(s -> s.getStatus() == ApprovalStepStatus.WAITING)
                .forEach(s -> s.setStatus(ApprovalStepStatus.CANCELLED));
        flow.setStatus(ApprovalFlowStatus.REJECTED);
        flow.setFinishedAt(now);
        flowRepository.save(flow);
        record(flow, step, ApprovalEventAction.REJECTED, actor, reason, null);
        if (flow.getSubjectType() == ApprovalSubjectType.ADJUSTMENT) {
            eventPublisher.publishEvent(new ApprovalChainEvents.AdjustmentDecided(flow.getId()));
        }
    }

    // ── Dừng flow ──────────────────────────────────────────────────────────

    /** Dừng mọi flow đang chạy của các KPI này (chỉ tiêu + điều chỉnh). */
    @Transactional
    public void cancelRunning(Collection<UUID> kpiIds, User actor, LocalizedText reason) {
        stopRunning(kpiIds, ApprovalFlowStatus.CANCELLED, ApprovalEventAction.CANCELLED, actor, reason);
    }

    /** Khoá kỳ chốt KPI dở: flow của chúng dừng theo. */
    @Transactional
    public void closeByLock(Collection<UUID> kpiIds, User actor, LocalizedText reason) {
        stopRunning(kpiIds, ApprovalFlowStatus.CLOSED_BY_LOCK, ApprovalEventAction.CLOSED_BY_LOCK, actor, reason);
    }

    @Transactional
    public void cancelRunningAdjustment(UUID adjustmentId, User actor, LocalizedText reason) {
        flowRepository.findRunningIdByAdjustment(adjustmentId).ifPresent(id ->
                finish(lockFlow(id), ApprovalFlowStatus.CANCELLED, ApprovalEventAction.CANCELLED, actor, reason));
    }

    private void stopRunning(Collection<UUID> kpiIds, ApprovalFlowStatus status, ApprovalEventAction action,
                             User actor, LocalizedText reason) {
        if (kpiIds == null || kpiIds.isEmpty()) return;
        for (UUID id : flowRepository.findRunningIdsByKpiIds(kpiIds)) {
            finish(lockFlow(id), status, action, actor, reason);
        }
    }

    private void finish(KpiApprovalFlow flow, ApprovalFlowStatus status, ApprovalEventAction action,
                        User actor, LocalizedText reason) {
        if (flow.getStatus().isTerminal()) return;
        flow.getSteps().stream()
                .filter(s -> s.getStatus() == ApprovalStepStatus.PENDING || s.getStatus() == ApprovalStepStatus.WAITING)
                .forEach(s -> s.setStatus(ApprovalStepStatus.CANCELLED));
        flow.setStatus(status);
        flow.setFinishedAt(Instant.now());
        flowRepository.save(flow);
        record(flow, null, action, actor, reason, null);
    }

    /** Lý do hệ thống ghi: lưu bản tiếng Việt vào reason và key + tham số vào reason_i18n. */
    private void record(KpiApprovalFlow flow, KpiApprovalStep step, ApprovalEventAction action,
                        User actor, LocalizedText reason, Map<String, Object> detail) {
        save(flow, step, action, actor, reason == null ? null : reason.render(SupportedLanguages.DEFAULT_LOCALE),
                reason == null ? null : reason.toJson(), detail);
    }

    // ── Gán lại (admin) ─────────────────────────────────────────────────────

    /**
     * Admin (SYSTEM:ADMIN ở đơn vị gốc) gán lại người giữ bước ĐANG CHỜ. Đây là việc duy nhất admin
     * làm được trên chuỗi của người khác — duyệt thay thì không.
     */
    @Transactional
    public KpiApprovalFlow reassign(UUID stepId, User actor, UUID newApproverId, String reason) {
        UUID flowId = stepRepository.findFlowIdByStepId(stepId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalStep"), "id", stepId));
        KpiApprovalFlow peek = flowRepository.findById(flowId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalChain"), "id", flowId));
        KpiCriteria kpi = peek.getKpiCriteria();

        if (!permissionChecker.isGlobalAdminIn(actor.getId(), kpi.getOrgUnit().getId())) {
            throw new ForbiddenException(ErrorCode.ONLY_ORGANIZATION_ADMINISTRATORS_MAY_REASSIGN_APPROVER);
        }
        cycleStatusGuard.assertWritable(kpi);

        KpiApprovalFlow flow = lockFlow(flowId);
        KpiApprovalStep step = flow.currentStep()
                .filter(s -> s.getId().equals(stepId))
                .orElseThrow(() -> new StaleStateException(ErrorCode.STEP_NO_LONGER_PENDING_APPROVAL_RELOAD));

        User target = userRepository.findById(newApproverId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "id", newApproverId));
        if (target.getDeletedAt() != null || target.isPausedAccount()) {
            throw new BusinessException(ErrorCode.CHOSEN_PERSON_LEFT_DEACTIVATED);
        }
        if (!permissionChecker.isMemberOfOrganization(target.getId(), flow.getOrganizationId())) {
            throw new BusinessException(ErrorCode.CHOSEN_PERSON_OUTSIDE_ORGANIZATION);
        }
        if (flow.getRequester() != null && flow.getRequester().getId().equals(target.getId())) {
            throw new BusinessException(ErrorCode.SUBMITTER_CANNOT_ASSIGNED_APPROVER_THEIR_OWN_REQUEST);
        }

        String from = step.approverNames();
        step.getApprovers().clear();
        step.getApprovers().add(new KpiApprovalStep.StepApprover(target.getId(), target.getFullName()));
        step.setPendingSince(Instant.now());
        step.setLastRemindedAt(null);
        flowRepository.save(flow);
        record(flow, step, ApprovalEventAction.REASSIGNED, actor, reason,
                Map.of("from", from, "to", target.getFullName()));
        eventPublisher.publishEvent(new ApprovalChainEvents.StepAssigned(
                flow.getId(), step.getId(), ApprovalChainEvents.StepAssigned.Kind.REASSIGNED));
        return flow;
    }

    // ── Người duyệt bị vô hiệu hoá (C5) ────────────────────────────────────

    /**
     * Người duyệt nghỉ việc / bị vô hiệu hoá: rút họ khỏi các bước đang chờ. Còn người khác trong
     * nhóm thì nhóm tiếp tục giữ bước; hết người thì tự chuyển lên bước kế tiếp. Bước cuối không
     * còn cấp trên ⇒ giữ nguyên và báo admin gán lại.
     */
    @Transactional
    public void onApproverDeactivated(User user) {
        for (UUID flowId : flowRepository.findRunningIdsHeldBy(user.getId())) {
            KpiApprovalFlow flow = lockFlow(flowId);
            KpiApprovalStep step = flow.currentStep().orElse(null);
            if (step == null || !step.isHeldBy(user.getId())) continue;

            List<KpiApprovalStep.StepApprover> remaining = step.getApprovers().stream()
                    .filter(a -> !a.getUserId().equals(user.getId())).toList();
            if (!remaining.isEmpty()) {
                step.getApprovers().removeIf(a -> a.getUserId().equals(user.getId()));
                flowRepository.save(flow);
                record(flow, step, ApprovalEventAction.REASSIGNED, null,
                        LocalizedText.of("approvalEvent.reason.approverDeactivated", user.getFullName()),
                        Map.of("from", user.getFullName(), "to", step.approverNames()));
                continue;
            }

            Optional<KpiApprovalStep> next = flow.nextWaitingAfter(step.getStepOrder());
            if (next.isEmpty()) {
                eventPublisher.publishEvent(new ApprovalChainEvents.ReassignNeeded(flow.getId(), step.getId()));
                continue;
            }
            Instant now = Instant.now();
            step.setStatus(ApprovalStepStatus.SKIPPED_INACTIVE);
            LocalizedText skipInactive = LocalizedText.of("approval.skip.approverInactive", user.getFullName());
            step.setSkipReason(skipInactive.render(SupportedLanguages.DEFAULT_LOCALE));
            step.setSkipReasonI18n(skipInactive.toJson());
            KpiApprovalStep n = next.get();
            n.setStatus(ApprovalStepStatus.PENDING);
            n.setPendingSince(now);
            flow.setCurrentStepOrder(n.getStepOrder());
            flowRepository.save(flow);
            record(flow, step, ApprovalEventAction.AUTO_ESCALATED, null, step.getSkipReason(),
                    Map.of("nextHolders", n.approverNames()));
            eventPublisher.publishEvent(new ApprovalChainEvents.StepAssigned(
                    flow.getId(), n.getId(), ApprovalChainEvents.StepAssigned.Kind.ESCALATED));
        }
    }

    // ── Nhắc việc ──────────────────────────────────────────────────────────

    /** Nhắc người giữ bước nếu bước đã chờ quá số ngày cấu hình. Trả true nếu đã nhắc. */
    @Transactional
    public boolean remindIfOverdue(UUID flowId, Instant now) {
        KpiApprovalFlow flow = lockFlow(flowId);
        KpiApprovalStep step = flow.currentStep().orElse(null);
        if (step == null || step.getPendingSince() == null) return false;
        Instant cutoff = now.minus(java.time.Duration.ofDays(reminderDays(flow.getOrganizationId())));
        if (!step.getPendingSince().isBefore(cutoff)) return false;
        if (step.getLastRemindedAt() != null && !step.getLastRemindedAt().isBefore(cutoff)) return false;

        step.setLastRemindedAt(now);
        flowRepository.save(flow);
        record(flow, step, ApprovalEventAction.REMINDED, null, (String) null, null);
        eventPublisher.publishEvent(new ApprovalChainEvents.StepAssigned(
                flow.getId(), step.getId(), ApprovalChainEvents.StepAssigned.Kind.REMINDER));
        return true;
    }

    // ── Tiện ích ───────────────────────────────────────────────────────────

    private void record(KpiApprovalFlow flow, KpiApprovalStep step, ApprovalEventAction action,
                        User actor, String reason, Map<String, Object> detail) {
        save(flow, step, action, actor, reason, null, detail);
    }

    private void save(KpiApprovalFlow flow, KpiApprovalStep step, ApprovalEventAction action,
                      User actor, String reason, String reasonI18n, Map<String, Object> detail) {
        eventRepository.save(KpiApprovalEvent.builder()
                .flow(flow)
                .stepId(step == null ? null : step.getId())
                .stepOrder(step == null ? null : step.getStepOrder())
                .action(action)
                .actorId(actor == null ? null : actor.getId())
                .actorName(actor == null ? null : actor.getFullName())
                .reason(blankToNull(reason))
                .reasonI18n(reasonI18n)
                .detail(detail)
                .build());
        // Cùng transaction: dòng hệ thống trong khung thảo luận KPI commit cùng sự kiện duyệt.
        discussionTimeline.onApprovalEvent(flow, step, action, actor, blankToNull(reason));
    }

    private static UUID flowIdOf(KpiApprovalStep s) {
        return s.getFlow().getId();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }
}
