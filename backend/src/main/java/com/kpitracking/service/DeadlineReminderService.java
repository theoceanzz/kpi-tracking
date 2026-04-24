package com.kpitracking.service;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiReminder;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiReminderRepository;
import com.kpitracking.repository.KpiSubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeadlineReminderService {

    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiSubmissionRepository kpiSubmissionRepository;
    private final KpiReminderRepository kpiReminderRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;

    // Run every hour: 0 0 * * * *
    // For testing/demo purposes, we could run it more often, but once an hour is reasonable for deadlines.
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void processDeadlineReminders() {
        log.info("Starting deadline reminder process...");
        List<KpiCriteria> activeKpis = kpiCriteriaRepository.findByStatus(KpiStatus.APPROVED);
        Instant now = Instant.now();

        for (KpiCriteria kpi : activeKpis) {
            if (kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getStartDate() == null || kpi.getKpiPeriod().getEndDate() == null) {
                continue;
            }

            long start = kpi.getKpiPeriod().getStartDate().toEpochMilli();
            long end = kpi.getKpiPeriod().getEndDate().toEpochMilli();
            int expected = kpi.getExpectedSubmissions() != null ? kpi.getExpectedSubmissions() : calculateExpected(kpi);
            long totalDuration = end - start;
            long batchDuration = totalDuration / expected;

            for (User assignee : kpi.getAssignees()) {
                long subCount = kpiSubmissionRepository.countByKpiCriteriaIdAndSubmittedByIdAndDeletedAtIsNull(kpi.getId(), assignee.getId());
                
                if (subCount < expected) {
                    int nextBatch = (int) subCount + 1;
                    long batchStart = start + (nextBatch - 1) * batchDuration;
                    long batchEnd = start + nextBatch * batchDuration;
                    
                    // Halfway point: Start + 50% of batch duration
                    long reminderTime = batchStart + (batchDuration / 2);
                    Instant reminderInstant = Instant.ofEpochMilli(reminderTime);

                    if (now.isAfter(reminderInstant) && now.isBefore(Instant.ofEpochMilli(batchEnd))) {
                        // Check if reminder already sent for this batch
                        boolean alreadySent = kpiReminderRepository.findByKpiCriteriaIdAndUserIdAndBatchNumber(kpi.getId(), assignee.getId(), nextBatch).isPresent();
                        
                        if (!alreadySent) {
                            sendReminder(kpi, assignee, nextBatch);
                        }
                    }
                }
            }
        }
        log.info("Deadline reminder process completed.");
    }

    private void sendReminder(KpiCriteria kpi, User user, int batchNumber) {
        String title = "Nhắc nhở Deadline: " + kpi.getName();
        String message = String.format("Bạn đã đi qua một nửa thời gian của đợt nộp KPI thứ %d cho chỉ tiêu '%s'. Vui lòng hoàn thành báo cáo sớm nhất có thể!", 
                batchNumber, kpi.getName());

        // 1. Create In-App Notification
        notificationService.createNotification(kpi.getOrgUnit(), user, title, message, "DEADLINE_REMINDER", kpi.getId());

        // 2. Send Email
        emailService.sendNotificationEmail(user.getEmail(), title, message);

        // 3. Record that we sent it
        KpiReminder reminder = KpiReminder.builder()
                .kpiCriteria(kpi)
                .user(user)
                .batchNumber(batchNumber)
                .build();
        kpiReminderRepository.save(reminder);
        
        log.info("Sent halfway reminder to {} for KPI '{}' (Batch {})", user.getEmail(), kpi.getName(), batchNumber);
    }

    private int calculateExpected(KpiCriteria kpi) {
        if (kpi.getFrequency() == null || kpi.getKpiPeriod() == null || kpi.getKpiPeriod().getPeriodType() == null) {
            return 1;
        }
        com.kpitracking.enums.KpiFrequency kpiFreq = kpi.getFrequency();
        com.kpitracking.enums.KpiFrequency periodType = kpi.getKpiPeriod().getPeriodType();
        
        if (kpiFreq == periodType) return 1;
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.DAILY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 30;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 90;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 365;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.WEEKLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.MONTHLY) return 4;
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 13;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 52;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.MONTHLY) {
            if (periodType == com.kpitracking.enums.KpiFrequency.QUARTERLY) return 3;
            if (periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 12;
        }
        if (kpiFreq == com.kpitracking.enums.KpiFrequency.QUARTERLY && periodType == com.kpitracking.enums.KpiFrequency.YEARLY) return 4;
        return 1;
    }
}
