package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.enums.*;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.service.CollabITSupport;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.discussion.DiscussionService;
import com.kpitracking.service.kpi.KpiCollabHooks;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Công việc gắn KPI trên PostgreSQL THẬT. Chạy tay: {@code ./mvnw test -Dtest=KpiTaskIT}. Test 7–12 của đặc tả.
 */
class KpiTaskIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired KpiTaskReminderScheduler reminders;
    @Autowired KpiCriteriaService kpiCriteriaService;
    @Autowired KpiCriteriaRepository kpiCriteriaRepository;
    @Autowired DiscussionService discussionService;
    @Autowired KpiCollabHooks collabHooks;
    @Autowired PlatformTransactionManager txManager;

    private KpiTaskResponse task(String title, KpiTaskVisibility visibility) {
        loginAs(employee);
        return taskService.create(CreateKpiTaskRequest.builder().kpiId(kpiId).title(title).visibility(visibility).build());
    }

    private KpiTaskResponse setStatus(KpiTaskResponse t, KpiTaskStatus status) {
        return taskService.changeStatus(t.getId(), ChangeKpiTaskStatusRequest.builder().status(status).version(t.getVersion()).build());
    }

    @Test
    void test7_taskWithoutKpiOrOnSomeoneElsesKpiIsRejected() {
        loginAs(employee);
        assertThatThrownBy(() -> taskService.create(CreateKpiTaskRequest.builder().title("Không có KPI").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_REQUIRED));

        // KPI của đồng nghiệp: nhân viên này không tạo, không thực hiện.
        UUID othersKpi = newKpi("KPI của đồng nghiệp", "APPROVED", head, colleague);
        assertThatThrownBy(() -> taskService.create(CreateKpiTaskRequest.builder().kpiId(othersKpi).title("Lấn sân").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_NOT_OWNED));

        // KPI đã bị thay thì không nhận việc mới.
        UUID replaced = newKpi("KPI đã thay", "REPLACED", head, employee);
        assertThatThrownBy(() -> taskService.create(CreateKpiTaskRequest.builder().kpiId(replaced).title("Muộn rồi").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED));
    }

    @Test
    void test8_progressCountsDoneOverNonCancelled() {
        KpiTaskResponse a = task("Việc A", KpiTaskVisibility.KPI_SCOPE);
        KpiTaskResponse b = task("Việc B", KpiTaskVisibility.KPI_SCOPE);
        task("Việc C", KpiTaskVisibility.KPI_SCOPE);

        setStatus(a, KpiTaskStatus.DONE);
        setStatus(b, KpiTaskStatus.CANCELLED);

        var progress = kpiCriteriaService.getKpiCriteriaById(kpiId).getTaskProgress();
        assertThat(progress.getDone()).isEqualTo(1);
        assertThat(progress.getTotal()).isEqualTo(2);

        // Trưởng đơn vị (có TASK:VIEW_TEAM) thấy cùng tiến độ việc công khai của nhân viên.
        loginAs(head);
        assertThat(kpiCriteriaService.getKpiCriteriaById(kpiId).getTaskProgress().getTotal()).isEqualTo(2);
    }

    @Test
    void test9_lockedCycleMakesTasksReadOnlyButStillAllowsComments() throws Exception {
        KpiTaskResponse t = task("Việc trước khoá", KpiTaskVisibility.KPI_SCOPE);
        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);

        loginAs(employee);
        assertThatThrownBy(() -> setStatus(t, KpiTaskStatus.DONE))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.CYCLE_LOCKED));
        assertThatThrownBy(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(t.getVersion()).title("x").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.CYCLE_LOCKED));
        assertThat(taskService.get(t.getId()).getReadOnlyReason()).isEqualTo(KpiTaskResponse.ReadOnlyReason.CYCLE_LOCKED);

        // Phương án (a): bình luận vẫn được sau khoá kỳ, trên cả KPI lẫn task.
        assertThat(discussionService.create(DiscussionTargetType.KPI, kpiId, "Giải trình sau khoá", null, null, null)).isNotNull();
        assertThat(discussionService.create(DiscussionTargetType.TASK, t.getId(), "Ghi chú", null, null, null)).isNotNull();
    }

    @Test
    void test10a_deletedKpiKeepsTasksAsReadOnly() {
        KpiTaskResponse t = task("Việc của KPI sắp xoá", KpiTaskVisibility.KPI_SCOPE);
        loginAs(head);
        kpiCriteriaService.deleteKpiCriteria(kpiId);

        loginAs(employee);
        KpiTaskResponse after = taskService.get(t.getId());
        assertThat(after.isKpiDeleted()).isTrue();
        assertThat(after.getKpiName()).isEqualTo("IT KPI cộng tác");
        assertThat(after.getReadOnlyReason()).isEqualTo(KpiTaskResponse.ReadOnlyReason.KPI_DELETED);
        assertThatThrownBy(() -> setStatus(after, KpiTaskStatus.DONE))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_DELETED_READONLY));

        // Chuyển sang KPI khác được, xoá cũng được.
        UUID other = newKpi("KPI mới", "APPROVED", head, employee);
        int moved = taskService.move(MoveKpiTasksRequest.builder().fromKpiId(kpiId).toKpiId(other).build());
        assertThat(moved).isEqualTo(1);
        assertThat(taskService.get(t.getId()).getKpiId()).isEqualTo(other);
        taskService.delete(t.getId());
    }

    @Test
    void test10b_replacedKpiKeepsDiscussionLinksAndOffersToMoveTasks() throws Exception {
        KpiTaskResponse t = task("Việc ở KPI cũ", KpiTaskVisibility.KPI_SCOPE);
        UUID newId = newKpi("KPI thay thế", "APPROVED", head, employee);
        jdbc.update("UPDATE kpi_criteria SET status = 'REPLACED', replaced_by_id = ? WHERE id = ?", newId, kpiId);
        new TransactionTemplate(txManager).executeWithoutResult(s -> {
            KpiCriteria oldKpi = kpiCriteriaRepository.findById(kpiId).orElseThrow();
            KpiCriteria newKpi = kpiCriteriaRepository.findById(newId).orElseThrow();
            collabHooks.onReplaced(oldKpi, newKpi);
        });

        // Thảo luận ở lại KPI cũ, hai bên có dòng hệ thống trỏ sang nhau.
        loginAs(employee);
        var oldLines = discussionService.page(DiscussionTargetType.KPI, kpiId, null, 20).getContent();
        assertThat(oldLines).anySatisfy(c -> assertThat(c.getSystemMeta()).containsEntry("linkedKpiId", newId.toString()));
        var newLines = discussionService.page(DiscussionTargetType.KPI, newId, null, 20).getContent();
        assertThat(newLines).anySatisfy(c -> assertThat(c.getSystemMeta()).containsEntry("linkedKpiId", kpiId.toString()));

        // Task không tự chuyển: người thực hiện được báo và thấy gợi ý chuyển.
        assertThat(waitNotifications(employee, newId)).isEqualTo(1);
        assertThat(taskService.get(t.getId()).getKpiId()).isEqualTo(kpiId);
        assertThat(taskService.replacementCandidates(newId)).singleElement()
                .satisfies(r -> assertThat(r.getOpenTaskCount()).isEqualTo(1));
        taskService.move(MoveKpiTasksRequest.builder().fromKpiId(kpiId).toKpiId(newId).build());
        assertThat(taskService.get(t.getId()).getKpiId()).isEqualTo(newId);
    }

    @Test
    void test11_overdueTaskIsNotifiedAndFiltered() {
        KpiTaskResponse late = task("Việc trễ", KpiTaskVisibility.KPI_SCOPE);
        jdbc.update("UPDATE kpi_tasks SET due_date = ? WHERE id = ?", KpiTaskService.today().minusDays(2), late.getId());
        KpiTaskResponse fine = task("Việc còn hạn", KpiTaskVisibility.KPI_SCOPE);
        jdbc.update("UPDATE kpi_tasks SET due_date = ? WHERE id = ?", KpiTaskService.today().plusDays(5), fine.getId());

        new TransactionTemplate(txManager).executeWithoutResult(s -> reminders.sendOverdue());
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND reference_id = ? AND type = 'TASK'",
                Long.class, employee, late.getId());
        assertThat(n).isEqualTo(1L);
        // Không nhắc lại lần hai.
        new TransactionTemplate(txManager).executeWithoutResult(s -> reminders.sendOverdue());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE reference_id = ?", Long.class, late.getId())).isEqualTo(1L);

        loginAs(employee);
        var overdue = taskService.list(new KpiTaskService.ListQuery("ASSIGNED", null, periodId, null, null, null, "OVERDUE",
                null, null, null, null, false, 0, 50)).getContent();
        assertThat(overdue).extracting(KpiTaskResponse::getId).containsExactly(late.getId());
        assertThat(overdue.get(0).isOverdue()).isTrue();
    }

    @Test
    void test12_privateTaskIsHiddenFromEveryoneElse() {
        KpiTaskResponse secret = task("Ghi chú riêng", KpiTaskVisibility.PRIVATE);
        KpiTaskResponse shared = task("Việc công khai", KpiTaskVisibility.KPI_SCOPE);

        loginAs(head);
        assertThatThrownBy(() -> taskService.get(secret.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW));
        // Trưởng đơn vị xem được việc công khai nhưng chỉ đọc.
        assertThat(taskService.get(shared.getId()).getReadOnlyReason()).isEqualTo(KpiTaskResponse.ReadOnlyReason.NOT_OWNER);
        assertThatThrownBy(() -> setStatus(shared, KpiTaskStatus.DONE))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_EDIT));
        assertThat(taskService.tasksOfKpi(kpiId)).extracting(KpiTaskResponse::getId)
                .contains(shared.getId()).doesNotContain(secret.getId());

        // Đồng nghiệp không có TASK:VIEW_TEAM: không thấy cả việc công khai; người ngoài càng không.
        loginAs(colleague);
        assertThatThrownBy(() -> taskService.get(shared.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW));
        loginAs(outsider);
        assertThatThrownBy(() -> taskService.get(secret.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW));
    }

    @Test
    void staleVersionIsRejected() {
        KpiTaskResponse t = task("Hai tab cùng sửa", KpiTaskVisibility.KPI_SCOPE);
        loginAs(employee);
        taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(t.getVersion()).title("Tab 1").build());
        assertThatThrownBy(() -> taskService.update(t.getId(),
                UpdateKpiTaskRequest.builder().version(t.getVersion()).title("Tab 2").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_VERSION_CONFLICT));
        assertThat(taskService.history(t.getId())).extracting(h -> h.getAction()).contains(KpiTaskEventAction.CREATED);
    }
}
