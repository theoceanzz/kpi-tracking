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

        String title = "New KPI Submission";
        String message = String.format("A new submission has been made for KPI '%s' by %s. Actual value: %s",
                kpi.getName(),
                submission.getSubmittedBy().getFullName(),
                submission.getActualValue());

        notificationService.createNotification(creator, title, message, "SUBMISSION", submission.getId());
        emailService.sendNotificationEmail(creator.getEmail(), title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void handleSubmissionReviewed(SubmissionReviewedEvent event) {
        KpiSubmission submission = event.getSubmission();
        log.info("Handling submission reviewed event for submission: {}", submission.getId());

        User submitter = submission.getSubmittedBy();
        String statusText = submission.getStatus().name().toLowerCase();

        String title = "Submission " + submission.getStatus().name();
        String message = String.format("Your submission for KPI '%s' has been %s by %s.",
                submission.getKpiCriteria().getName(),
                statusText,
                submission.getReviewedBy().getFullName());

        if (submission.getReviewNote() != null) {
            message += " Note: " + submission.getReviewNote();
        }

        notificationService.createNotification(submitter, title, message, "REVIEW", submission.getId());
        emailService.sendNotificationEmail(submitter.getEmail(), title, message);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void handleKpiApproved(KpiCriteriaApprovedEvent event) {
        KpiCriteria kpi = event.getKpiCriteria();
        log.info("Handling KPI approved event for KPI: {}", kpi.getId());

        User creator = kpi.getCreatedBy();

        String title = "KPI Criteria Approved";
        String message = String.format("Your KPI criteria '%s' has been approved by %s.",
                kpi.getName(),
                kpi.getApprovedBy().getFullName());

        notificationService.createNotification(creator, title, message, "KPI_APPROVED", kpi.getId());
        emailService.sendNotificationEmail(creator.getEmail(), title, message);

        // Also notify the assigned user if applicable
        if (kpi.getAssignedTo() != null && !kpi.getAssignedTo().getId().equals(creator.getId())) {
            String assigneeMessage = String.format("You have been assigned a new KPI: '%s'.", kpi.getName());
            notificationService.createNotification(kpi.getAssignedTo(), "New KPI Assigned",
                    assigneeMessage, "KPI_ASSIGNED", kpi.getId());
            emailService.sendNotificationEmail(kpi.getAssignedTo().getEmail(), "New KPI Assigned", assigneeMessage);
        }
    }
}
