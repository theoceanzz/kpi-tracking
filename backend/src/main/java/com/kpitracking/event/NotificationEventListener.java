package com.kpitracking.event;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaRejectedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaApprovalRevertedEvent;
import com.kpitracking.event.KpiEvents.KpiCriteriaSubmittedForApprovalEvent;
import com.kpitracking.event.KpiEvents.KpiSubmittedEvent;
import com.kpitracking.event.KpiEvents.SubmissionReviewedEvent;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.NotificationService;
import com.kpitracking.service.OrgNotificationConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgNotificationConfigService configService;

    private UUID getOrgId(KpiSubmission submission) {
        return submission.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private UUID getOrgId(KpiCriteria kpi) {
        return kpi.getOrgUnit().getOrgHierarchyLevel().getOrganization().getId();
    }

    private void sendIfEnabled(UUID orgId, String eventCode, User recipient, com.kpitracking.entity.OrgUnit orgUnit,
                               String title, String message, String type, UUID referenceId) {
        boolean sendSystem = configService.isSystemEnabled(orgId, eventCode);
        boolean sendEmail = configService.isEmailEnabled(orgId, eventCode);

        if (sendSystem) {
            notificationService.createNotification(orgUnit, recipient, title, message, type, referenceId);
        }
        if (sendEmail) {
            emailService.sendNotificationEmail(recipient.getEmail(), title, message);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiSubmitted(KpiSubmittedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling KPI submitted event for submission: {}", submission.getId());

        KpiCriteria kpi = submission.getKpiCriteria();
        User submitter = submission.getSubmittedBy();

        String title = "Báo cáo KPI mới cần duyệt";
        String message = String.format("Nhân viên %s vừa nộp báo cáo cho chỉ tiêu KPI '%s'. Giá trị đạt được: %s. Vui lòng vào hệ thống để kiểm tra và duyệt.",
                submitter.getFullName(), kpi.getName(), submission.getActualValue());

        UUID orgId = getOrgId(submission);
        Set<UUID> notifiedIds = new HashSet<>();

        List<UserRoleOrgUnit> managers = userRoleOrgUnitRepository.findManagersByOrgUnitId(submission.getOrgUnit().getId());
        for (UserRoleOrgUnit uro : managers) {
            User manager = uro.getUser();
            if (!manager.getId().equals(submitter.getId()) && notifiedIds.add(manager.getId())) {
                sendIfEnabled(orgId, "submission_submitted", manager, submission.getOrgUnit(),
                        title, message, "SUBMISSION", submission.getId());
            }
        }

        User creator = kpi.getCreatedBy();
        if (!creator.getId().equals(submitter.getId()) && notifiedIds.add(creator.getId())) {
            sendIfEnabled(orgId, "submission_submitted", creator, submission.getOrgUnit(),
                    title, message, "SUBMISSION", submission.getId());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleSubmissionReviewed(SubmissionReviewedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling submission reviewed event for submission: {}", submission.getId());

        UUID orgId = getOrgId(submission);
        User submitter = submission.getSubmittedBy();
        String statusText = submission.getStatus().name().equals("APPROVED") ? "chấp nhận" : "từ chối";

        String title = "Báo cáo KPI đã được " + statusText;
        String message = String.format("Báo cáo cho chỉ tiêu '%s' của bạn đã được %s bởi %s.",
                submission.getKpiCriteria().getName(), statusText, submission.getReviewedBy().getFullName());

        if (submission.getReviewNote() != null) {
            message += " Ghi chú: " + submission.getReviewNote();
        }

        sendIfEnabled(orgId, "submission_reviewed", submitter, submission.getOrgUnit(),
                title, message, "REVIEW", submission.getId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiApproved(KpiCriteriaApprovedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approved event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        // Toggle: kpi_approved — thông báo cho người tạo KPI
        String approvedTitle = "Chỉ tiêu KPI đã được duyệt";
        String approvedMessage = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã được phê duyệt bởi %s.",
                kpi.getName(), kpi.getApprovedBy().getFullName());

        sendIfEnabled(orgId, "kpi_approved", creator, kpi.getOrgUnit(),
                approvedTitle, approvedMessage, "KPI_APPROVED", kpi.getId());

        // Toggle: kpi_assigned — thông báo cho từng người được giao
        if (kpi.getAssignees() != null && !kpi.getAssignees().isEmpty()) {
            String assignedTitle = "KPI mới được giao";
            for (User assignee : kpi.getAssignees()) {
                if (!assignee.getId().equals(creator.getId())) {
                    String assignedMessage = String.format("Bạn vừa được giao một chỉ tiêu KPI mới: '%s'.", kpi.getName());
                    sendIfEnabled(orgId, "kpi_assigned", assignee, kpi.getOrgUnit(),
                            assignedTitle, assignedMessage, "KPI_ASSIGNED", kpi.getId());
                }
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiRejected(KpiCriteriaRejectedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI rejected event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI bị từ chối";
        String message = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã bị từ chối bởi %s.",
                kpi.getName(), kpi.getApprovedBy().getFullName());

        if (kpi.getRejectReason() != null && !kpi.getRejectReason().isBlank()) {
            message += " Lý do: " + kpi.getRejectReason();
        }

        sendIfEnabled(orgId, "kpi_rejected", creator, kpi.getOrgUnit(),
                title, message, "KPI_REJECTED", kpi.getId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiSubmittedForApproval(KpiCriteriaSubmittedForApprovalEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI submitted for approval event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User submitter = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI mới cần phê duyệt";
        String message = String.format("%s vừa gửi chỉ tiêu KPI '%s' để chờ phê duyệt. Vui lòng vào hệ thống để xem xét.",
                submitter.getFullName(), kpi.getName());

        Set<UUID> notifiedIds = new HashSet<>();
        List<com.kpitracking.entity.User> approvers =
                userRoleOrgUnitRepository.findUsersWithPermissionInOrgUnit(kpi.getOrgUnit().getId(), "KPI:APPROVE_CRITERIA");

        for (com.kpitracking.entity.User approver : approvers) {
            if (!approver.getId().equals(submitter.getId()) && notifiedIds.add(approver.getId())) {
                sendIfEnabled(orgId, "kpi_submitted", approver, kpi.getOrgUnit(),
                        title, message, "KPI_SUBMITTED", kpi.getId());
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handleKpiApprovalReverted(KpiCriteriaApprovalRevertedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approval reverted event for KPI: {}", kpi.getId());

        UUID orgId = getOrgId(kpi);
        User creator = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI bị hoàn duyệt";
        String message = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã bị hoàn duyệt (huỷ phê duyệt) bởi %s và cần được xem xét lại.",
                kpi.getName(), event.getRevertedBy().getFullName());

        sendIfEnabled(orgId, "kpi_approval_reverted", creator, kpi.getOrgUnit(),
                title, message, "KPI_APPROVAL_REVERTED", kpi.getId());
    }
}
