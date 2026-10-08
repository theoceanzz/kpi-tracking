package com.kpitracking.service.task;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.KpiTaskReminder;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiTaskReminderRepository;
import com.kpitracking.repository.KpiTaskRepository;
import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Nhắc việc, mặc định 5 phút một lần (có nhắc theo giờ): các mốc nhắc của từng task tới giờ, và nhắc quá hạn. Mỗi mốc /
 * mỗi lần quá hạn chỉ gửi MỘT lần — đánh dấu trước khi gửi bằng câu UPDATE có điều kiện, nên hai máy chủ cùng chạy job
 * cũng không gửi trùng. Mốc trễ quá {@link #MAX_LATENESS} (máy chủ tắt lâu) thì bỏ, không dội nhắc muộn.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KpiTaskReminderScheduler {

    public static final String NOTIFICATION_TYPE = "TASK";
    static final Duration MAX_LATENESS = Duration.ofHours(12);
    private static final int BATCH = 500;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final KpiTaskRepository taskRepository;
    private final KpiTaskReminderRepository reminderRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final NotificationDispatcher dispatcher;

    @Scheduled(cron = "${app.tasks.reminder-cron:0 */5 * * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void run() {
        int reminders = sendReminders(Instant.now());
        int overdue = sendOverdue();
        if (reminders + overdue > 0) log.info("Nhắc việc: {} mốc nhắc, {} quá hạn", reminders, overdue);
    }

    int sendReminders(Instant now) {
        List<KpiTaskReminder> due = reminderRepository.findDue(now, now.minus(MAX_LATENESS), BATCH);
        int sent = 0;
        for (KpiTaskReminder r : due) {
            try {
                if (reminderRepository.markSent(r.getId(), now) == 0) continue;
                KpiTask t = taskRepository.findById(r.getTaskId()).orElse(null);
                KpiCriteria kpi = t == null ? null : kpiCriteriaRepository.findById(t.getKpiCriteriaId()).orElse(null);
                if (t == null || kpi == null) continue;
                dispatcher.dispatch(t.getOrganizationId(), "task_due_soon", t.getOwner(), kpi.getOrgUnit(),
                        LocalizedText.of("notif.task.reminder.title"),
                        LocalizedText.of("notif.task.reminder.message", t.getTitle(), kpi.getName(), dueLabel(t)),
                        NOTIFICATION_TYPE, t.getId());
                sent++;
            } catch (Exception e) {
                log.error("Không gửi được mốc nhắc {}", r.getId(), e);
            }
        }
        return sent;
    }

    int sendOverdue() {
        LocalDate today = KpiTaskService.today();
        List<KpiTask> tasks = taskRepository.findOverdueToRemind(today, LocalTime.now(KpiTaskService.ZONE).withNano(0), BATCH);
        Instant now = Instant.now();
        int sent = 0;
        for (KpiTask t : tasks) {
            try {
                if (taskRepository.markOverdueReminded(t.getId(), now) == 0) continue;
                KpiCriteria kpi = kpiCriteriaRepository.findById(t.getKpiCriteriaId()).orElse(null);
                if (kpi == null) continue;
                dispatcher.dispatch(t.getOrganizationId(), "task_overdue", t.getOwner(), kpi.getOrgUnit(),
                        LocalizedText.of("notif.task.overdue.title"),
                        LocalizedText.of("notif.task.overdue.message", t.getTitle(), kpi.getName(), dueLabel(t)),
                        NOTIFICATION_TYPE, t.getId());
                sent++;
            } catch (Exception e) {
                log.error("Không nhắc quá hạn được việc {}", t.getId(), e);
            }
        }
        return sent;
    }

    private static String dueLabel(KpiTask t) {
        if (t.getDueDate() == null) return "";
        return t.getDueTime() == null ? DATE.format(t.getDueDate()) : DATE_TIME.format(t.getDueDate().atTime(t.getDueTime()));
    }
}
