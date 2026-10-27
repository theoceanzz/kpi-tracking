package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tóm tắt việc buổi sáng trên PostgreSQL THẬT: một thông báo / người / ngày, đếm đúng việc quá hạn + đến hạn hôm nay + ngày mai,
 * việc đã xong không tính. Chạy tay: {@code ./mvnw test -Dtest=TaskDailyDigestIT}.
 */
class TaskDailyDigestIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired TaskDailyDigestScheduler digest;
    @Autowired KpiTaskRepository taskRepository;

    private Instant started;

    @BeforeEach
    void mark() {
        started = Instant.now().minusSeconds(1);
        // Bản tóm tắt hôm nay (nếu job thật đã chạy trên DB dev) sẽ chặn lần gửi của test.
        jdbc.update("DELETE FROM notifications WHERE user_id = ? AND type = ?", employee, TaskDailyDigestScheduler.NOTIFICATION_TYPE);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM notifications WHERE user_id = ? AND type = ? AND created_at >= ?",
                employee, TaskDailyDigestScheduler.NOTIFICATION_TYPE, Timestamp.from(started));
        jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM kpi_tasks WHERE created_by = ? AND created_at >= ?)",
                employee, Timestamp.from(started));
        jdbc.update("DELETE FROM kpi_tasks WHERE created_by = ? AND created_at >= ? AND kpi_criteria_id IS NULL", employee, Timestamp.from(started));
    }

    /** Cột 2 = đến hạn hôm nay, cột 3 = quá hạn, cột 4 = đến hạn ngày mai (của {@link #employee}, cộng mọi tổ chức). */
    private long count(LocalDate today, int col) {
        return taskRepository.digestCounts(today).stream().filter(r -> employee.equals(r[0]))
                .mapToLong(r -> ((Number) r[col]).longValue()).sum();
    }

    @Test
    void oneDigestPerDay_countsDueTodayAndOverdue_skipsDone() {
        LocalDate today = KpiTaskService.today();
        long dueBefore = count(today, 2), overBefore = count(today, 3), tomorrowBefore = count(today, 4);

        loginAs(employee);
        taskService.create(CreateKpiTaskRequest.builder().title("Hạn hôm nay").dueDate(today).assigneeIds(List.of(employee)).build());
        taskService.create(CreateKpiTaskRequest.builder().title("Quá hạn").dueDate(today.minusDays(2)).assigneeIds(List.of(employee)).build());
        var done = taskService.create(CreateKpiTaskRequest.builder().title("Đã xong").dueDate(today).assigneeIds(List.of(employee)).build());
        jdbc.update("UPDATE kpi_tasks SET status = 'DONE' WHERE id = ?", done.getId());
        taskService.create(CreateKpiTaskRequest.builder().title("Tuần sau").dueDate(today.plusDays(7)).assigneeIds(List.of(employee)).build());
        taskService.create(CreateKpiTaskRequest.builder().title("Ngày mai").dueDate(today.plusDays(1)).assigneeIds(List.of(employee)).build());

        assertThat(count(today, 2)).isEqualTo(dueBefore + 1);
        assertThat(count(today, 3)).isEqualTo(overBefore + 1);
        assertThat(count(today, 4)).isEqualTo(tomorrowBefore + 1);

        assertThat(digest.send(today, employee::equals)).isEqualTo(1);
        String msg = jdbc.queryForObject("SELECT message_i18n FROM notifications WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1",
                String.class, employee, TaskDailyDigestScheduler.NOTIFICATION_TYPE);
        assertThat(msg).contains("notif.task.digest.message");

        // Chạy lại trong ngày: không gửi trùng
        assertThat(digest.send(today, employee::equals)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notifications WHERE user_id = ? AND type = ?", Long.class,
                employee, TaskDailyDigestScheduler.NOTIFICATION_TYPE)).isEqualTo(1);
    }
}
