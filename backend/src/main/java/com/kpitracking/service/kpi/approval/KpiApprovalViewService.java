package com.kpitracking.service.kpi.approval;

import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.dto.response.kpi.KpiCriteriaResponse;
import com.kpitracking.dto.response.kpi.approval.ApprovalFlowResponse;
import com.kpitracking.dto.response.kpi.approval.ApprovalSummaryResponse;
import com.kpitracking.dto.response.kpi.approval.KpiApprovalChainResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.KpiCriteriaMapper;
import com.kpitracking.repository.KpiApprovalEventRepository;
import com.kpitracking.repository.KpiApprovalFlowRepository;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Chuỗi duyệt KPI — phần ĐỌC: vị trí hiện tại cho bảng danh sách, stepper + lịch sử cho màn chi
 * tiết, và hộp "chờ tôi duyệt".
 *
 * <p>Mọi phép tính "bấm duyệt sẽ là duyệt cuối hay chuyển lên" ở đây chỉ để HIỂN THỊ; lúc bấm thật
 * {@link KpiApprovalChainService#authorize} kiểm lại từ đầu.
 */
@Service
@RequiredArgsConstructor
public class KpiApprovalViewService {

    private final KpiApprovalFlowRepository flowRepository;
    private final KpiApprovalEventRepository eventRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiCriteriaMapper kpiCriteriaMapper;
    private final PermissionChecker permissionChecker;
    private final KpiApprovalChainService chainService;

    private final com.kpitracking.repository.UserRepository userRepository;

    public User currentUser() {
        String email = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }

    /** Bộ nhớ đệm trong MỘT lượt tính, để bảng 50 dòng không hỏi quyền 50 lần. */
    private final class Ctx {
        final UUID viewerId;
        final Map<UUID, Boolean> finalByUnit = new HashMap<>();
        final Map<UUID, Boolean> adminByOrg = new HashMap<>();

        Ctx(UUID viewerId) {
            this.viewerId = viewerId;
        }

        boolean hasFinal(UUID unitId) {
            return finalByUnit.computeIfAbsent(unitId, id ->
                    permissionChecker.hasRolePermissionInOrgUnit(viewerId, KpiApprovalChainService.PERM_FINAL, id));
        }

        boolean isAdmin(UUID orgId) {
            return adminByOrg.computeIfAbsent(orgId, id -> permissionChecker.isGlobalAdminOfOrganization(viewerId, id));
        }
    }

    // ── Tóm tắt cho danh sách ───────────────────────────────────────────────

    /** Gắn {@code approval} vào các chỉ tiêu đang chờ duyệt theo chuỗi. */
    @Transactional(readOnly = true)
    public void enrichCriteria(Collection<KpiCriteriaResponse> responses, UUID viewerId) {
        if (responses == null || responses.isEmpty() || viewerId == null) return;
        List<UUID> ids = responses.stream()
                .filter(r -> r.getStatus() == KpiStatus.PENDING_APPROVAL)
                .map(KpiCriteriaResponse::getId).toList();
        if (ids.isEmpty()) return;
        Map<UUID, KpiApprovalFlow> byKpi = flowRepository.findRunningByKpiIds(ids).stream()
                .filter(f -> f.getSubjectType() == ApprovalSubjectType.CRITERIA)
                .collect(Collectors.toMap(f -> f.getKpiCriteria().getId(), Function.identity(), (a, b) -> a));
        Ctx ctx = new Ctx(viewerId);
        for (KpiCriteriaResponse r : responses) {
            KpiApprovalFlow f = byKpi.get(r.getId());
            if (f != null) r.setApproval(summarize(f, ctx));
        }
    }

    /** Tóm tắt các flow điều chỉnh đang chạy, theo id yêu cầu điều chỉnh. */
    @Transactional(readOnly = true)
    public Map<UUID, ApprovalSummaryResponse> summariesForAdjustments(Collection<UUID> adjustmentIds, UUID viewerId) {
        if (adjustmentIds == null || adjustmentIds.isEmpty() || viewerId == null) return Map.of();
        Ctx ctx = new Ctx(viewerId);
        Map<UUID, ApprovalSummaryResponse> out = new HashMap<>();
        for (KpiApprovalFlow f : flowRepository.findRunningByAdjustmentIds(adjustmentIds)) {
            out.put(f.getAdjustmentRequest().getId(), summarize(f, ctx));
        }
        return out;
    }

    public ApprovalSummaryResponse summarize(KpiApprovalFlow flow, UUID viewerId) {
        return summarize(flow, new Ctx(viewerId));
    }

    private ApprovalSummaryResponse summarize(KpiApprovalFlow flow, Ctx ctx) {
        KpiApprovalStep step = flow.currentStep().orElse(null);
        if (step == null) return null;

        List<KpiApprovalStep> counted = flow.getSteps().stream()
                .filter(s -> s.getStatus() != ApprovalStepStatus.SKIPPED_NO_HEAD).toList();
        int number = (int) counted.stream().filter(s -> s.getStepOrder() <= step.getStepOrder()).count();

        boolean canAct = step.isHeldBy(ctx.viewerId);
        Optional<KpiApprovalStep> next = flow.nextWaitingAfter(step.getStepOrder());
        ApprovalOutcome kind = null;
        if (canAct) {
            boolean isFinal = next.isEmpty() || step.getKind() == ApprovalStepKind.ADMIN_FALLBACK
                    || ctx.hasFinal(flow.getKpiCriteria().getOrgUnit().getId());
            kind = isFinal ? ApprovalOutcome.FINAL : ApprovalOutcome.FORWARDED;
        }

        return ApprovalSummaryResponse.builder()
                .flowId(flow.getId())
                .subjectType(flow.getSubjectType())
                .round(flow.getRound())
                .stepId(step.getId())
                .stepNumber(number)
                .totalSteps(counted.size())
                .currentUnitName(step.getOrgUnitName())
                .holderIds(step.getApprovers().stream().map(KpiApprovalStep.StepApprover::getUserId).toList())
                .holderNames(step.getApprovers().stream().map(KpiApprovalStep.StepApprover::getUserName).toList())
                .pendingSince(step.getPendingSince())
                .canAct(canAct)
                .actionKind(kind)
                .nextHolderNames(kind == ApprovalOutcome.FORWARDED ? next.map(KpiApprovalStep::approverNames).orElse(null) : null)
                .nextUnitName(kind == ApprovalOutcome.FORWARDED ? next.map(KpiApprovalStep::getOrgUnitName).orElse(null) : null)
                .canReassign(ctx.isAdmin(flow.getOrganizationId()))
                .build();
    }

    // ── Hộp chờ duyệt ───────────────────────────────────────────────────────

    /** Chỉ tiêu đang chờ ĐÚNG người này ở bước hiện tại. */
    @Transactional(readOnly = true)
    public List<KpiCriteriaResponse> criteriaInbox(UUID viewerId, UUID kpiPeriodId, UUID orgUnitId) {
        Ctx ctx = new Ctx(viewerId);
        List<KpiCriteriaResponse> out = new ArrayList<>();
        for (KpiApprovalFlow f : flowRepository.findInbox(viewerId, ApprovalSubjectType.CRITERIA)) {
            KpiCriteria kpi = f.getKpiCriteria();
            if (kpi.getDeletedAt() != null || kpi.getStatus() != KpiStatus.PENDING_APPROVAL) continue;
            if (kpiPeriodId != null && (kpi.getKpiPeriod() == null || !kpiPeriodId.equals(kpi.getKpiPeriod().getId()))) continue;
            if (orgUnitId != null && !orgUnitId.equals(kpi.getOrgUnit().getId())) continue;
            KpiCriteriaResponse r = kpiCriteriaMapper.toResponse(kpi);
            r.setApproval(summarize(f, ctx));
            out.add(r);
        }
        out.sort(Comparator.comparing((KpiCriteriaResponse r) -> r.getApproval().getPendingSince(),
                Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    /** Flow đang chờ đúng người này ở bước hiện tại. */
    @Transactional(readOnly = true)
    public List<KpiApprovalFlow> inboxFlows(UUID viewerId, ApprovalSubjectType type) {
        return flowRepository.findInbox(viewerId, type);
    }

    @Transactional(readOnly = true)
    public long inboxCount(UUID viewerId, ApprovalSubjectType type) {
        return flowRepository.countInbox(viewerId, type);
    }

    // ── Chi tiết: stepper + lịch sử ────────────────────────────────────────

    @Transactional(readOnly = true)
    public KpiApprovalChainResponse chainOf(UUID kpiId, UUID viewerId) {
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        List<KpiApprovalFlow> flows = flowRepository.findByKpiCriteriaIdOrderByStartedAtDesc(kpiId);
        requireCanView(kpi, flows, viewerId);

        Map<UUID, List<KpiApprovalEvent>> eventsByFlow = flows.isEmpty() ? Map.of()
                : eventRepository.findByFlowIdInOrderByCreatedAtAsc(flows.stream().map(KpiApprovalFlow::getId).toList())
                        .stream().collect(Collectors.groupingBy(e -> e.getFlow().getId()));

        Ctx ctx = new Ctx(viewerId);
        ApprovalSummaryResponse current = flows.stream()
                .filter(f -> f.getSubjectType() == ApprovalSubjectType.CRITERIA && f.getStatus() == ApprovalFlowStatus.IN_PROGRESS)
                .findFirst().map(f -> summarize(f, ctx)).orElse(null);

        return KpiApprovalChainResponse.builder()
                .kpiCriteriaId(kpi.getId())
                .kpiName(kpi.getName())
                .chainMode(chainService.isChainMode(kpi))
                .current(current)
                .flows(flows.stream().map(f -> toResponse(f, eventsByFlow.getOrDefault(f.getId(), List.of()))).toList())
                .build();
    }

    /**
     * Ai được xem lịch sử duyệt: người tạo, người được giao, người từng/đang giữ một bước, người
     * có quyền xem/duyệt KPI trong đơn vị (cấp trên giám sát), admin tổ chức.
     */
    private void requireCanView(KpiCriteria kpi, List<KpiApprovalFlow> flows, UUID viewerId) {
        if (kpi.getCreatedBy() != null && kpi.getCreatedBy().getId().equals(viewerId)) return;
        if (kpi.getAssignees() != null && kpi.getAssignees().stream().anyMatch(u -> u.getId().equals(viewerId))) return;
        for (KpiApprovalFlow f : flows) {
            if (f.getRequester() != null && f.getRequester().getId().equals(viewerId)) return;
            if (f.getSteps().stream().anyMatch(s -> s.isHeldBy(viewerId))) return;
        }
        UUID unitId = kpi.getOrgUnit().getId();
        if (permissionChecker.hasAnyPermissionInOrgUnit(viewerId, unitId,
                "KPI:VIEW", "KPI:APPROVE_CRITERIA", "KPI:APPROVE_ADJUSTMENT")) return;
        if (permissionChecker.isGlobalAdminIn(viewerId, unitId)) return;
        throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_KPI_APPROVAL_HISTORY);
    }

    private ApprovalFlowResponse toResponse(KpiApprovalFlow f, List<KpiApprovalEvent> events) {
        return ApprovalFlowResponse.builder()
                .id(f.getId())
                .subjectType(f.getSubjectType())
                .kpiCriteriaId(f.getKpiCriteria().getId())
                .adjustmentRequestId(f.getAdjustmentRequest() == null ? null : f.getAdjustmentRequest().getId())
                .round(f.getRound())
                .status(f.getStatus())
                .requesterId(f.getRequester() == null ? null : f.getRequester().getId())
                .requesterName(f.getRequester() == null ? null : f.getRequester().getFullName())
                .currentStepOrder(f.getStatus() == ApprovalFlowStatus.IN_PROGRESS ? f.getCurrentStepOrder() : null)
                .startedAt(f.getStartedAt())
                .finishedAt(f.getFinishedAt())
                .steps(f.getSteps().stream().map(this::toStep).toList())
                .events(events.stream().map(e -> ApprovalFlowResponse.Event.builder()
                        .id(e.getId())
                        .action(e.getAction())
                        .stepOrder(e.getStepOrder())
                        .actorId(e.getActorId())
                        .actorName(e.getActorName())
                        .reason(LocalizedText.renderOr(e.getReasonI18n(), e.getReason(), ErrorMessages.currentLocale()))
                        .detail(e.getDetail())
                        .createdAt(e.getCreatedAt())
                        .build()).toList())
                .build();
    }

    private ApprovalFlowResponse.Step toStep(KpiApprovalStep s) {
        return ApprovalFlowResponse.Step.builder()
                .id(s.getId())
                .order(s.getStepOrder())
                .kind(s.getKind())
                .orgUnitId(s.getOrgUnitId())
                .orgUnitName(s.getOrgUnitName())
                .mergedUnitNames(s.getMergedUnits() == null ? List.of()
                        : s.getMergedUnits().stream().map(m -> String.valueOf(m.get("name"))).toList())
                .status(s.getStatus())
                .skipReason(LocalizedText.renderOr(s.getSkipReasonI18n(), s.getSkipReason(), ErrorMessages.currentLocale()))
                .approvers(s.getApprovers().stream()
                        .map(a -> ApprovalFlowResponse.Person.builder().id(a.getUserId()).name(a.getUserName()).build())
                        .toList())
                .actedById(s.getActedBy() == null ? null : s.getActedBy().getId())
                .actedByName(s.getActedBy() == null ? null : s.getActedBy().getFullName())
                .actedAt(s.getActedAt())
                .reason(s.getReason())
                .pendingSince(s.getPendingSince())
                .build();
    }
}
