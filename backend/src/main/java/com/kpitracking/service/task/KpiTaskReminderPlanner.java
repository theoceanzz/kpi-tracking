package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.KpiTaskReminderInput;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.KpiTaskReminder;
import com.kpitracking.enums.KpiTaskReminderKind;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.KpiTaskReminderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Objects;

/**
 * Mốc nhắc của công việc: tính {@code remind_at} từ hạn, thay cả bộ, tính lại khi đổi hạn, chép sang lần lặp kế tiếp.
 *
 * <p>Hạn cả ngày (không có giờ) lấy 09:00 giờ VN làm mốc: "đúng hạn" = 09:00 ngày hạn, "trước 1 ngày" = 09:00 hôm trước.
 */
@Component
@RequiredArgsConstructor
public class KpiTaskReminderPlanner {

    public static final LocalTime ALL_DAY_ANCHOR = LocalTime.of(9, 0);
    public static final int MAX_REMINDERS = 5;
    public static final int DEFAULT_OFFSET_MINUTES = 1440;

    private final KpiTaskReminderRepository reminderRepository;

    /** Mốc "hạn" dùng để tính nhắc; null khi task không có hạn. */
    public static Instant dueInstant(KpiTask t) {
        if (t.getDueDate() == null) return null;
        LocalTime time = t.getDueTime() != null ? t.getDueTime() : ALL_DAY_ANCHOR;
        return t.getDueDate().atTime(time).atZone(KpiTaskService.ZONE).toInstant();
    }

    public static Instant compute(KpiTask t, KpiTaskReminderKind kind, Integer offsetMinutes, Instant customAt) {
        if (kind == KpiTaskReminderKind.CUSTOM) return customAt;
        Instant due = dueInstant(t);
        if (due == null) return null;
        return kind == KpiTaskReminderKind.AT_DUE ? due : due.minusSeconds(60L * (offsetMinutes == null ? 0 : offsetMinutes));
    }

    /** Thay toàn bộ mốc nhắc của task. {@code null} = mặc định (trước 1 ngày nếu có hạn); rỗng = không nhắc. */
    public void replace(KpiTask task, List<KpiTaskReminderInput> inputs) {
        List<KpiTaskReminderInput> list = inputs != null ? inputs
                : task.getDueDate() != null
                    ? List.of(KpiTaskReminderInput.builder().kind(KpiTaskReminderKind.BEFORE).offsetMinutes(DEFAULT_OFFSET_MINUTES).build())
                    : List.of();
        validate(task, list);
        reminderRepository.deleteByTaskId(task.getId());
        reminderRepository.flush();
        for (KpiTaskReminderInput in : list) {
            reminderRepository.save(KpiTaskReminder.builder()
                    .taskId(task.getId())
                    .kind(in.getKind())
                    .offsetMinutes(in.getKind() == KpiTaskReminderKind.BEFORE ? in.getOffsetMinutes() : null)
                    .customAt(in.getKind() == KpiTaskReminderKind.CUSTOM ? in.getCustomAt() : null)
                    .remindAt(compute(task, in.getKind(), in.getOffsetMinutes(), in.getCustomAt()))
                    .build());
        }
    }

    /** Hạn vừa đổi: tính lại mốc theo hạn; mốc đổi thì được gửi lại (xoá {@code sent_at}). */
    public void recompute(KpiTask task) {
        for (KpiTaskReminder r : reminderRepository.findByTaskIdOrderByCreatedAtAsc(task.getId())) {
            Instant at = compute(task, r.getKind(), r.getOffsetMinutes(), r.getCustomAt());
            if (!Objects.equals(at, r.getRemindAt())) {
                r.setRemindAt(at);
                r.setSentAt(null);
                reminderRepository.save(r);
            }
        }
    }

    /** Chép các mốc (theo kiểu, không theo giờ tuyệt đối) sang task khác — lần lặp kế tiếp / bản sao. */
    public void copy(KpiTask from, KpiTask to) {
        for (KpiTaskReminder r : reminderRepository.findByTaskIdOrderByCreatedAtAsc(from.getId())) {
            if (r.getKind() == KpiTaskReminderKind.CUSTOM) continue; // giờ tuyệt đối không có nghĩa ở lần sau
            reminderRepository.save(KpiTaskReminder.builder()
                    .taskId(to.getId())
                    .kind(r.getKind())
                    .offsetMinutes(r.getOffsetMinutes())
                    .remindAt(compute(to, r.getKind(), r.getOffsetMinutes(), null))
                    .build());
        }
    }

    private static void validate(KpiTask task, List<KpiTaskReminderInput> list) {
        if (list.size() > MAX_REMINDERS) throw new BusinessException(ErrorCode.TASK_REMINDER_INVALID);
        for (KpiTaskReminderInput in : list) {
            if (in == null || in.getKind() == null) throw new BusinessException(ErrorCode.TASK_REMINDER_INVALID);
            switch (in.getKind()) {
                case AT_DUE -> { if (task.getDueDate() == null) throw new BusinessException(ErrorCode.TASK_REMINDER_INVALID); }
                case BEFORE -> {
                    if (task.getDueDate() == null || in.getOffsetMinutes() == null
                            || in.getOffsetMinutes() < 1 || in.getOffsetMinutes() > 60 * 24 * 30) {
                        throw new BusinessException(ErrorCode.TASK_REMINDER_INVALID);
                    }
                }
                case CUSTOM -> { if (in.getCustomAt() == null) throw new BusinessException(ErrorCode.TASK_REMINDER_INVALID); }
            }
        }
    }
}
