package com.kpitracking.service.kpi.approval;

import com.kpitracking.dto.response.kpi.approval.ApprovalInboxItemResponse;
import com.kpitracking.dto.response.kpi.approval.KpiApprovalChainResponse;
import com.kpitracking.entity.kpi.KpiApprovalFlow;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.kpi.ApprovalOutcome;
import com.kpitracking.enums.kpi.ApprovalSubjectType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.kpi.KpiApprovalFlowRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Hộp "Chờ tôi duyệt" chung và duyệt / từ chối các đề xuất có {@link ApprovalSubjectHandler}.
 * Luật thao tác là luật của chuỗi duyệt: chỉ người giữ bước hiện tại, admin chỉ gán lại, không tự
 * duyệt đề xuất của mình — {@link KpiApprovalChainService#authorize} kiểm tất cả.
 */
@Service
@RequiredArgsConstructor
public class ApprovalActionService {

    private final KpiApprovalFlowRepository flowRepository;
    private final KpiApprovalChainService chainService;
    private final KpiApprovalViewService viewService;
    private final PermissionChecker permissionChecker;
    private final List<ApprovalSubjectHandler> handlerList;

    private Map<ApprovalSubjectType, ApprovalSubjectHandler> handlers() {
        return handlerList.stream().collect(Collectors.toMap(ApprovalSubjectHandler::type, Function.identity()));
    }

    private ApprovalSubjectHandler handlerOf(UUID flowId) {
        ApprovalSubjectType type = flowRepository.findSubjectTypeById(flowId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalChain"), "id", flowId));
        ApprovalSubjectHandler h = handlers().get(type);
        if (h == null) throw new BusinessException(ErrorCode.APPROVAL_FLOW_NOT_ACTIONABLE_HERE);
        return h;
    }

    @Transactional
    public ApprovalOutcome approve(UUID flowId, UUID expectedStepId, String comment) {
        User me = viewService.currentUser();
        ApprovalSubjectHandler h = handlerOf(flowId);
        h.guard(flowRepository.findPayloadById(flowId));
        KpiApprovalChainService.Decision d = chainService.authorize(flowId, me, expectedStepId);
        ApprovalOutcome outcome = chainService.approve(d, me, comment);
        if (outcome == ApprovalOutcome.FINAL) h.apply(d.flow(), me);
        return outcome;
    }

    @Transactional
    public void reject(UUID flowId, UUID expectedStepId, String reason) {
        User me = viewService.currentUser();
        ApprovalSubjectHandler h = handlerOf(flowId);
        h.guard(flowRepository.findPayloadById(flowId));
        KpiApprovalChainService.Decision d = chainService.authorize(flowId, me, expectedStepId);
        chainService.reject(d, me, reason);
        h.onRejected(d.flow(), me, reason);
    }

    /** Mọi việc đang chờ ĐÚNG người gọi ở bước hiện tại, cũ trước. */
    @Transactional(readOnly = true)
    public List<ApprovalInboxItemResponse> inbox() {
        User me = viewService.currentUser();
        Set<ApprovalSubjectType> actionable = handlers().keySet();
        List<ApprovalInboxItemResponse> out = new ArrayList<>();
        for (KpiApprovalFlow f : flowRepository.findInboxAll(me.getId())) {
            if (f.getKpiCriteria() != null && f.getKpiCriteria().getDeletedAt() != null) continue;
            // Đơn từ có hộp "Cần duyệt" riêng ở mục Đơn từ.
            if (f.getSubjectType() == ApprovalSubjectType.FORM_REQUEST) continue;
            out.add(toItem(f, me.getId(), actionable.contains(f.getSubjectType())));
        }
        out.sort(Comparator.comparing((ApprovalInboxItemResponse i) -> i.getApproval() == null ? null : i.getApproval().getPendingSince(),
                Comparator.nullsLast(Comparator.naturalOrder())));
        return out;
    }

    public record Detail(ApprovalInboxItemResponse item, KpiApprovalChainResponse chain) {}

    /** Một đề xuất kèm chuỗi duyệt: người gửi, người đã/đang giữ bước, admin tổ chức xem được. */
    @Transactional(readOnly = true)
    public Detail detail(UUID flowId) {
        User me = viewService.currentUser();
        KpiApprovalFlow f = flowRepository.findById(flowId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalChain"), "id", flowId));
        boolean allowed = (f.getRequester() != null && f.getRequester().getId().equals(me.getId()))
                || chainService.isSubjectViewer(f.getSubjectType(), f.getSubjectId(), me.getId())
                || permissionChecker.isGlobalAdminOfOrganization(me.getId(), f.getOrganizationId());
        if (!allowed) throw new ForbiddenException(ErrorCode.NO_PERMISSION_VIEW_APPROVAL_FLOW);
        KpiApprovalChainResponse chain = viewService.chainOfSubject(f.getSubjectType(), f.getSubjectId(), f.displayName(), me.getId());
        return new Detail(toItem(f, me.getId(), handlers().containsKey(f.getSubjectType())), chain);
    }

    private ApprovalInboxItemResponse toItem(KpiApprovalFlow f, UUID viewerId, boolean actionable) {
        OrgUnit unit = f.unit();
        return ApprovalInboxItemResponse.builder()
                .flowId(f.getId())
                .subjectType(f.getSubjectType())
                .subjectId(f.getSubjectId())
                .subjectName(f.displayName())
                .orgUnitId(unit == null ? null : unit.getId())
                .orgUnitName(unit == null ? null : unit.getName())
                .requesterId(f.getRequester() == null ? null : f.getRequester().getId())
                .requesterName(f.getRequester() == null ? null : f.getRequester().getFullName())
                .processTitle(f.getProcessTitle())
                .startedAt(f.getStartedAt())
                .payload(f.getPayload())
                .actionable(actionable)
                .approval(viewService.summarize(f, viewerId))
                .build();
    }
}
