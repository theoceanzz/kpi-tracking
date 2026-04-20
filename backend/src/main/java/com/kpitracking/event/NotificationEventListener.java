package com.kpitracking.event;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiSubmission;
import com.kpitracking.entity.User;
import com.kpitracking.service.EmailService;
import com.kpitracking.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationEventListener {

    private final NotificationService notificationService;
    private final EmailService emailService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void handleKpiSubmitted(KpiSubmittedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling KPI submitted event for submission: {}", submission.getId());

        // Notify the KPI criteria creator or department head
        KpiCriteria kpi = submission.getKpiCriteria();
        User creator = kpi.getCreatedBy();

        String title = "Báo cáo KPI mới";
        String message = String.format("KPI '%s' vừa có báo cáo mới từ %s. Giá trị đạt được: %s",
                kpi.getName(),
                submission.getSubmittedBy().getFullName(),
                submission.getActualValue());

        notificationService.createNotification(submission.getOrgUnit(), creator, title, message, "SUBMISSION", submission.getId());
        emailService.sendNotificationEmail(creator.getEmail(), title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void handleSubmissionReviewed(SubmissionReviewedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling submission reviewed event for submission: {}", submission.getId());

        User submitter = submission.getSubmittedBy();
        String statusText = submission.getStatus().name().equals("APPROVED") ? "chấp nhận" : "từ chối";

        String title = "Báo cáo KPI đã được " + statusText;
        String message = String.format("Báo cáo cho chỉ tiêu '%s' của bạn đã được %s bởi %s.",
                submission.getKpiCriteria().getName(),
                statusText,
                submission.getReviewedBy().getFullName());

        if (submission.getReviewNote() != null) {
            message += " Ghi chú: " + submission.getReviewNote();
        }

        notificationService.createNotification(submission.getOrgUnit(), submitter, title, message, "REVIEW", submission.getId());
        emailService.sendNotificationEmail(submitter.getEmail(), title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void handleKpiApproved(KpiCriteriaApprovedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approved event for KPI: {}", kpi.getId());

        User creator = kpi.getCreatedBy();

        String title = "Chỉ tiêu KPI đã được duyệt";
        String message = String.format("Chỉ tiêu KPI '%s' do bạn tạo đã được phê duyệt bởi %s.",
                kpi.getName(),
                kpi.getApprovedBy().getFullName());

        notificationService.createNotification(kpi.getOrgUnit(), creator, title, message, "KPI_APPROVED", kpi.getId());
        emailService.sendNotificationEmail(creator.getEmail(), title, message);

        // Also notify all assigned users
        if (kpi.getAssignees() != null && !kpi.getAssignees().isEmpty()) {
            for (User assignee : kpi.getAssignees()) {
                if (!assignee.getId().equals(creator.getId())) {
                    String assigneeMessage = String.format("Bạn vừa được giao một chỉ tiêu KPI mới: '%s'.", kpi.getName());
                    notificationService.createNotification(kpi.getOrgUnit(), assignee, "KPI mới được giao",
                            assigneeMessage, "KPI_ASSIGNED", kpi.getId());
                    emailService.sendNotificationEmail(assignee.getEmail(), "KPI mới được giao", assigneeMessage);
                }
            }
        }
    }
}
