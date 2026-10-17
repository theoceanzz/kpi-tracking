package com.kpitracking.service.task;

import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.KpiTaskAssignee;
import com.kpitracking.entity.task.KpiTaskReminder;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.task.TaskCompletionMode;
import com.kpitracking.enums.user.UserStatus;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.task.KpiTaskAssigneeRepository;
import com.kpitracking.repository.task.KpiTaskReminderRepository;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
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
 *
 * <p>Người nhận: MỌI người thực hiện còn hoạt động (kiểu ALL: chỉ người chưa tích phần mình). Việc không KPI cũng được
 * nhắc; việc của KPI đã xoá thì không (chỉ đọc).
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
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
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
                if (t == null) continue;
                KpiCriteria kpi = t.getKpiCriteriaId() == null ? null : kpiCriteriaRepository.findById(t.getKpiCriteriaId()).orElse(null);
                if (t.getKpiCriteriaId() != null && kpi == null) continue;
                LocalizedText message = kpi != null
                        ? LocalizedText.of("notif.task.reminder.message", t.getTitle(), kpi.getName(), dueLabel(t))
                        : LocalizedText.of("notif.task.reminder.messageNoKpi", t.getTitle(), dueLabel(t));
                for (User u : recipients(t)) {
                    dispatcher.dispatch(t.getOrganizationId(), "task_due_soon", u, unitFor(kpi, u),
                            LocalizedText.of("notif.task.reminder.title"), message, NOTIFICATION_TYPE, t.getId());
                    sent++;
                }
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
                KpiCriteria kpi = t.getKpiCriteriaId() == null ? null : kpiCriteriaRepository.findById(t.getKpiCriteriaId()).orElse(null);
                if (t.getKpiCriteriaId() != null && kpi == null) continue;
                LocalizedText message = kpi != null
                        ? LocalizedText.of("notif.task.overdue.message", t.getTitle(), kpi.getName(), dueLabel(t))
                        : LocalizedText.of("notif.task.overdue.messageNoKpi", t.getTitle(), dueLabel(t));
                for (User u : recipients(t)) {
                    dispatcher.dispatch(t.getOrganizationId(), "task_overdue", u, unitFor(kpi, u),
                            LocalizedText.of("notif.task.overdue.title"), message, NOTIFICATION_TYPE, t.getId());
                    sent++;
                }
            } catch (Exception e) {
                log.error("Không nhắc quá hạn được việc {}", t.getId(), e);
            }
        }
        return sent;
    }

    /** Người thực hiện còn hoạt động; kiểu ALL bỏ người đã tích phần mình. */
    private List<User> recipients(KpiTask t) {
        List<KpiTaskAssignee> rows = assigneeRepository.findByTaskIdOrderByAddedAtAsc(t.getId());
        List<java.util.UUID> ids = rows.stream()
                .filter(a -> t.getCompletionMode() != TaskCompletionMode.ALL || a.getCompletedAt() == null)
                .map(KpiTaskAssignee::getUserId).toList();
        if (ids.isEmpty() && rows.isEmpty()) ids = List.of(t.getOwner().getId());
        return userRepository.findAllById(ids).stream()
                .filter(u -> u.getDeletedAt() == null && u.getStatus() == UserStatus.ACTIVE).toList();
    }

    private OrgUnit unitFor(KpiCriteria kpi, User to) {
        if (kpi != null && kpi.getOrgUnit() != null) return kpi.getOrgUnit();
        return userRoleOrgUnitRepository.findByUserId(to.getId()).stream()
                .map(UserRoleOrgUnit::getOrgUnit).findFirst().orElse(null);
    }

    private static String dueLabel(KpiTask t) {
        if (t.getDueDate() == null) return "";
        return t.getDueTime() == null ? DATE.format(t.getDueDate()) : DATE_TIME.format(t.getDueDate().atTime(t.getDueTime()));
    }
}
