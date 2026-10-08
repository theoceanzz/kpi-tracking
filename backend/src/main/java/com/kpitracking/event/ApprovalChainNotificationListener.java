package com.kpitracking.event;

import com.kpitracking.entity.*;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.ApprovalFlowStatus;
import com.kpitracking.enums.ApprovalStepStatus;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.ApprovalProcessRepository;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Thông báo của chuỗi duyệt: mỗi lần chuyển bước báo ĐÚNG người giữ bước kế tiếp (không rải lên
 * cả cây quản lý), nhắc khi bước chờ quá hạn, và báo người xin điều chỉnh khi có quyết định cuối.
 * Duyệt cuối / từ chối chỉ tiêu thì {@link NotificationEventListener} đã báo người tạo.
 *
 * <p>Transaction của các listener KHÔNG được để {@code readOnly}: thông báo được ghi trong chính
 * transaction này, mà transaction chỉ-đọc đặt Hibernate ở FlushMode.MANUAL nên bản ghi thông báo
 * không bao giờ được INSERT — không lỗi, không log, người duyệt cứ thế không nhận được gì.
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
    private final ApprovalProcessRepository processRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
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
    @Transactional(propagation = Propagation.REQUIRES_NEW)
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
    @Transactional(propagation = Propagation.REQUIRES_NEW)
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

    /** Yêu cầu vừa bắt đầu theo quy trình — báo người theo dõi (người giữ bước đầu đã có thông báo riêng). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onProcessFlowStarted(ApprovalChainEvents.ProcessFlowStarted event) {
        KpiApprovalFlow flow = flowRepository.findById(event.flowId()).orElse(null);
        if (flow == null || flow.getProcessId() == null) return;
        notifyFollowers(flow, "kpi_submitted",
                LocalizedText.of("notif.approval.follower.started.title"),
                "notif.approval.follower.started.message");
    }

    /** Flow theo quy trình có kết quả cuối — báo người theo dõi. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onProcessFlowFinished(ApprovalChainEvents.ProcessFlowFinished event) {
        KpiApprovalFlow flow = flowRepository.findById(event.flowId()).orElse(null);
        if (flow == null || flow.getProcessId() == null) return;
        boolean approved = flow.getStatus() == ApprovalFlowStatus.APPROVED;
        String outcome = approved ? "approved" : "rejected";
        notifyFollowers(flow, approved ? "kpi_approved" : "kpi_rejected",
                LocalizedText.of("notif.approval.follower.finished.title." + outcome),
                "notif.approval.follower.finished.message." + outcome);
    }

    /** Người theo dõi hiện tại của quy trình, trừ người gửi và người đang giữ bước (họ đã được báo). */
    private void notifyFollowers(KpiApprovalFlow flow, String code, LocalizedText title, String messageKey) {
        var process = processRepository.findById(flow.getProcessId()).orElse(null);
        if (process == null || process.getFollowerIds().isEmpty()) return;

        Set<java.util.UUID> skip = new HashSet<>();
        if (flow.getRequester() != null) skip.add(flow.getRequester().getId());
        flow.currentStep().ifPresent(s -> s.getApprovers().forEach(a -> skip.add(a.getUserId())));

        KpiCriteria kpi = flow.getKpiCriteria();
        boolean adjustment = flow.getSubjectType() == ApprovalSubjectType.ADJUSTMENT;
        LocalizedText what = LocalizedText.of("notif.approval.what." + (adjustment ? "adjustment" : "kpi"), kpi.getName());
        Object requester = flow.getRequester() == null ? ""
                : LocalizedText.of("notif.approval.requester", flow.getRequester().getFullName());
        LocalizedText message = LocalizedText.of(messageKey, what, requester, process.getTitle());
        String type = adjustment ? "ADJUSTMENT_REQUEST" : "KPI_SUBMITTED";
        java.util.UUID refId = adjustment ? flow.getAdjustmentRequest().getId() : kpi.getId();

        for (java.util.UUID followerId : process.getFollowerIds()) {
            if (skip.contains(followerId)) continue;
            User u = userRepository.findById(followerId).orElse(null);
            if (u == null || u.getDeletedAt() != null || u.isPausedAccount()) continue;
            dispatcher.dispatch(flow.getOrganizationId(), code, u, kpi.getOrgUnit(), title, message, type, refId);
        }
    }
}
