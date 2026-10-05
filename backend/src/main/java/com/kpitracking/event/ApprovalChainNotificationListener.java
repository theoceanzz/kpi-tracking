package com.kpitracking.event;

import com.kpitracking.entity.*;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.ApprovalStepStatus;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.KpiApprovalFlowRepository;
import com.kpitracking.repository.OrgUnitRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thông báo của chuỗi duyệt: mỗi lần chuyển bước báo ĐÚNG người giữ bước kế tiếp (không rải lên
 * cả cây quản lý), nhắc khi bước chờ quá hạn, và báo người xin điều chỉnh khi có quyết định cuối.
 * Duyệt cuối / từ chối chỉ tiêu thì {@link NotificationEventListener} đã báo người tạo.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApprovalChainNotificationListener {

    private final KpiApprovalFlowRepository flowRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final NotificationDispatcher dispatcher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onStepAssigned(ApprovalChainEvents.StepAssigned event) {
        KpiApprovalFlow flow = flowRepository.findById(event.flowId()).orElse(null);
        if (flow == null) return;
        KpiApprovalStep step = flow.getSteps().stream()
                .filter(s -> s.getId().equals(event.stepId())).findFirst().orElse(null);
        // Tới lúc gửi mà bước đã được xử lý (người khác vừa duyệt) thì thôi.
        if (step == null || step.getStatus() != ApprovalStepStatus.PENDING) return;

        KpiCriteria kpi = flow.getKpiCriteria();
        boolean adjustment = flow.getSubjectType() == ApprovalSubjectType.ADJUSTMENT;
        String kind = adjustment ? "adjustment" : "kpi";
        LocalizedText what = LocalizedText.of("notif.approval.what." + kind, kpi.getName());
        LocalizedText whatLower = LocalizedText.of("notif.approval.whatLower." + kind, kpi.getName());
        Object requester = flow.getRequester() == null ? ""
                : LocalizedText.of("notif.approval.requester", flow.getRequester().getFullName());
        long total = flow.getSteps().stream().filter(s -> s.getStatus() != ApprovalStepStatus.SKIPPED_NO_HEAD).count();
        long number = flow.getSteps().stream()
                .filter(s -> s.getStatus() != ApprovalStepStatus.SKIPPED_NO_HEAD && s.getStepOrder() <= step.getStepOrder()).count();

        String code = "kpi_submitted";
        LocalizedText title;
        LocalizedText message;
        switch (event.kind()) {
            case REMINDER -> {
                code = "kpi_approval_reminder";
                long days = step.getPendingSince() == null ? 0
                        : Duration.between(step.getPendingSince(), Instant.now()).toDays();
                title = LocalizedText.of("notif.approval.reminder.title");
                message = LocalizedText.of("notif.approval.reminder.message", what, requester, days, number, total);
            }
            case REASSIGNED -> {
                title = LocalizedText.of("notif.approval.reassigned.title." + kind);
                message = LocalizedText.of("notif.approval.reassigned.message", whatLower, requester, number, total);
            }
            case FORWARDED -> {
                title = LocalizedText.of("notif.approval.needsApproval.title." + kind);
                message = LocalizedText.of("notif.approval.forwarded.message", what, requester, number, total);
            }
            case ESCALATED -> {
                title = LocalizedText.of("notif.approval.needsApproval.title." + kind);
                message = LocalizedText.of("notif.approval.escalated.message", what, requester, number, total);
            }
            default -> {
                title = LocalizedText.of(adjustment ? "notif.approval.needsApproval.title.adjustment" : "notif.approval.new.title.kpi");
                message = LocalizedText.of("notif.approval.new.message", what, requester, number, total);
            }
        }

        String type = adjustment ? "ADJUSTMENT_REQUEST" : "KPI_SUBMITTED";
        java.util.UUID refId = adjustment ? flow.getAdjustmentRequest().getId() : kpi.getId();
        for (KpiApprovalStep.StepApprover a : step.getApprovers()) {
            User u = userRepository.findById(a.getUserId()).orElse(null);
            if (u == null || u.getDeletedAt() != null || u.isPausedAccount()) continue;
            dispatcher.dispatch(flow.getOrganizationId(), code, u, kpi.getOrgUnit(), title, message, type, refId);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onAdjustmentDecided(ApprovalChainEvents.AdjustmentDecided event) {
        KpiApprovalFlow flow = flowRepository.findById(event.flowId()).orElse(null);
        if (flow == null || flow.getAdjustmentRequest() == null || flow.getRequester() == null) return;
        KpiAdjustmentRequest adj = flow.getAdjustmentRequest();
        KpiCriteria kpi = flow.getKpiCriteria();
        boolean approved = adj.getStatus() == AdjustmentStatus.APPROVED;
        Object by = adj.getReviewer() == null ? "" : LocalizedText.of("notif.common.by", adj.getReviewer().getFullName());
        String outcome = approved ? "approved" : "rejected";
        Object reason = !approved && adj.getReviewerNote() != null && !adj.getReviewerNote().isBlank()
                ? LocalizedText.of("notif.common.reasonSuffix", adj.getReviewerNote()) : "";
        LocalizedText title = LocalizedText.of("notif.approval.adjustmentDecided.title." + outcome);
        LocalizedText message = LocalizedText.of("notif.approval.adjustmentDecided.message." + outcome, kpi.getName(), by, reason);
        dispatcher.dispatch(flow.getOrganizationId(), approved ? "kpi_approved" : "kpi_rejected",
                flow.getRequester(), kpi.getOrgUnit(), title, message, "ADJUSTMENT_DECIDED", adj.getId());
    }

    /** Bước cuối không còn ai giữ — báo mọi admin tổ chức để gán lại. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onReassignNeeded(ApprovalChainEvents.ReassignNeeded event) {
        KpiApprovalFlow flow = flowRepository.findById(event.flowId()).orElse(null);
        if (flow == null) return;
        KpiCriteria kpi = flow.getKpiCriteria();
        LocalizedText title = LocalizedText.of("notif.approval.reassignNeeded.title");
        LocalizedText message = LocalizedText.of("notif.approval.reassignNeeded.message", kpi.getName());
        Map<java.util.UUID, User> admins = new LinkedHashMap<>();
        for (OrgUnit root : orgUnitRepository.findRootsByOrganizationId(flow.getOrganizationId())) {
            for (User u : userRoleOrgUnitRepository.findUsersWithPermissionInOrgUnit(root.getId(), "SYSTEM:ADMIN")) {
                if (u.getDeletedAt() == null && !u.isPausedAccount()) admins.putIfAbsent(u.getId(), u);
            }
        }
        for (User admin : admins.values()) {
            dispatcher.dispatch(flow.getOrganizationId(), "kpi_approval_reminder", admin, kpi.getOrgUnit(),
                    title, message, "KPI_SUBMITTED", kpi.getId());
        }
    }
}
