package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.task.KpiTaskEventResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.TaskRecurrence;
import com.kpitracking.enums.*;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.CollabITSupport;
import com.kpitracking.service.discussion.DiscussionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Công việc kiểu Lark trên PostgreSQL THẬT — 13 test của phần D. Fixture ({@link CollabITSupport}): trưởng đơn vị
 * {@code head} (có TASK:ASSIGN), hai nhân viên {@code employee}, {@code colleague} (không có), người ngoài tổ chức;
 * KPI đã duyệt do trưởng giao cho {@code employee}, trong đợt 01/01–31/03/2099.
 * Chạy tay: {@code ./mvnw test -Dtest=KpiTaskLarkIT}.
 */
class KpiTaskLarkIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired KpiTaskReminderScheduler scheduler;
    @Autowired DiscussionService discussionService;
    @Autowired PlatformTransactionManager txManager;

    /** Thứ 6 đầu tiên của tháng 1/2099 — nằm trong đợt của fixture. */
    private static final LocalDate FIRST_FRIDAY = LocalDate.of(2099, 1, 1).with(TemporalAdjusters.nextOrSame(DayOfWeek.FRIDAY));

    private KpiTaskResponse create(UUID as, CreateKpiTaskRequest req) {
        loginAs(as);
        return taskService.create(req);
    }

    private CreateKpiTaskRequest.CreateKpiTaskRequestBuilder base(String title) {
        return CreateKpiTaskRequest.builder().kpiId(kpiId).title(title);
    }

    private KpiTaskResponse done(KpiTaskResponse t, boolean force) {
        return taskService.changeStatus(t.getId(), ChangeKpiTaskStatusRequest.builder()
                .status(KpiTaskStatus.DONE).version(t.getVersion()).force(force).build());
    }

    private List<UUID> seriesIds(UUID seriesId) {
        return jdbc.queryForList("SELECT id FROM kpi_tasks WHERE series_id = ? AND deleted_at IS NULL ORDER BY series_index", UUID.class, seriesId);
    }

    // ── 1–4. Giao việc, người theo dõi ────────────────────────────────────────────────────────

    @Test
    void d1_headAssignsTaskToEmployee_onEmployeesKpi_employeeNotified() throws Exception {
        KpiTaskResponse t = create(head, base("Chuẩn bị số liệu tháng").ownerId(employee).build());
        assertThat(t.getOwnerId()).isEqualTo(employee);
        assertThat(t.getKpiId()).isEqualTo(kpiId);       // KPI của nhân viên (người thực hiện)
        assertThat(t.getCreatedById()).isEqualTo(head);
        assertThat(waitNotifications(employee, t.getId())).isEqualTo(1);
        // Người được giao thấy việc trong "Tôi phụ trách", người giao thấy trong "Tôi giao cho người khác".
        loginAs(employee);
        assertThat(taskService.list(query("ASSIGNED")).getContent()).extracting(KpiTaskResponse::getId).contains(t.getId());
        loginAs(head);
        assertThat(taskService.list(query("DELEGATED")).getContent()).extracting(KpiTaskResponse::getId).contains(t.getId());
    }

    @Test
    void d2_assigningOutsideAllowedScopeIsBlocked() {
        UUID colleagueKpi = newKpi("KPI của đồng nghiệp", "APPROVED", head, colleague);
        // Nhân viên không có TASK:ASSIGN: chỉ tự giao cho mình.
        assertThatThrownBy(() -> create(employee, CreateKpiTaskRequest.builder().kpiId(colleagueKpi).title("Giao ngang")
                .ownerId(colleague).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGN_NOT_ALLOWED));
        // Trưởng đơn vị không giao được cho người ngoài tổ chức.
        assertThatThrownBy(() -> create(head, base("Giao ra ngoài").ownerId(outsider).build()))
                .satisfies(e -> assertThat(codeOf(e)).isIn(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH, ErrorCode.TASK_ASSIGN_NOT_ALLOWED));
        // Giao cho đúng người nhưng sai KPI (KPI không phải của người đó).
        assertThatThrownBy(() -> create(head, base("Sai KPI").ownerId(colleague).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH));
    }

    @Test
    void d3_followerCanViewAndCommentButNotEdit() throws Exception {
        KpiTaskResponse t = create(employee, base("Việc riêng có người theo dõi").visibility(KpiTaskVisibility.PRIVATE).build());
        loginAs(employee);
        taskService.addFollower(t.getId(), colleague);
        assertThat(waitNotifications(colleague, t.getId())).isEqualTo(1);

        loginAs(colleague);
        KpiTaskResponse seen = taskService.get(t.getId());   // xem được kể cả việc riêng tư
        assertThat(seen.isFollowing()).isTrue();
        assertThat(seen.isCanEdit()).isFalse();
        assertThat(discussionService.create(DiscussionTargetType.TASK, t.getId(), "Mình theo dõi nhé", null, null, null)).isNotNull();
        assertThatThrownBy(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(seen.getVersion()).title("Sửa trộm").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_EDIT));

        // Người ngoài tổ chức không thêm được làm người theo dõi (không xem được KPI).
        loginAs(employee);
        assertThatThrownBy(() -> taskService.addFollower(t.getId(), outsider))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FOLLOWER_NOT_ALLOWED));
    }

    @Test
    void d4_reassignNotifiesOldAndNewOwner_andHistoryIsRecorded() throws Exception {
        UUID colleagueKpi = newKpi("KPI của đồng nghiệp", "APPROVED", head, colleague);
        KpiTaskResponse t = create(head, base("Việc sẽ giao lại").ownerId(employee).build());
        assertThat(waitNotifications(employee, t.getId())).isEqualTo(1);

        loginAs(head);
        KpiTaskResponse moved = taskService.assign(t.getId(), AssignKpiTaskRequest.builder()
                .ownerId(colleague).kpiId(colleagueKpi).version(t.getVersion()).build());
        assertThat(moved.getOwnerId()).isEqualTo(colleague);
        assertThat(moved.getKpiId()).isEqualTo(colleagueKpi);
        assertThat(waitNotifications(colleague, t.getId())).isEqualTo(1);
        assertThat(waitNotificationCount(employee, t.getId(), 2)).isEqualTo(2); // được giao + bị giao lại

        List<KpiTaskEventResponse> history = taskService.history(t.getId());
        String employeeName = userRepository.findById(employee).orElseThrow().getFullName();
        String colleagueName = userRepository.findById(colleague).orElseThrow().getFullName();
        assertThat(history).anySatisfy(h -> {
            assertThat(h.getAction()).isEqualTo(KpiTaskEventAction.REASSIGNED);
            assertThat(h.getOldValue()).isEqualTo(employeeName);
            assertThat(h.getNewValue()).isEqualTo(colleagueName);
        });
        assertThat(history).anySatisfy(h -> assertThat(h.getAction()).isEqualTo(KpiTaskEventAction.ASSIGNED));
    }

    // ── 5–7. Lặp lại ──────────────────────────────────────────────────────────────────────────

    private KpiTaskResponse weekly(String title, LocalDate due, LocalDate endDate) {
        return create(employee, base(title).dueDate(due).checklist(List.of("Bước 1", "Bước 2"))
                .recurrence(TaskRecurrence.builder().freq(TaskRecurrence.Freq.WEEKLY).interval(1).byWeekday(List.of(5)).build())
                .recurrenceEndDate(endDate).build());
    }

    @Test
    void d5_completingWeeklyTaskCreatesNextOccurrenceWithUntickedChecklist() {
        KpiTaskResponse t = weekly("Báo cáo tuần", FIRST_FRIDAY, null);
        loginAs(employee);
        KpiTaskResponse detail = taskService.get(t.getId());
        detail.getChecklist().forEach(i -> taskService.updateChecklistItem(t.getId(), i.getId(),
                KpiTaskChecklistRequest.builder().done(true).build()));
        done(taskService.get(t.getId()), false);

        List<UUID> series = seriesIds(t.getId());
        assertThat(series).hasSize(2);
        KpiTaskResponse next = taskService.get(series.get(1));
        assertThat(next.getDueDate()).isEqualTo(FIRST_FRIDAY.plusWeeks(1));
        assertThat(next.getTitle()).isEqualTo("Báo cáo tuần");
        assertThat(next.getOwnerId()).isEqualTo(employee);
        assertThat(next.getStatus()).isEqualTo(KpiTaskStatus.TODO);
        assertThat(next.getChecklist()).hasSize(2).allSatisfy(i -> assertThat(i.isDone()).isFalse());
        assertThat(next.getReminders()).hasSize(1); // mốc mặc định "trước 1 ngày" được chép theo hạn mới
    }

    @Test
    void d6_recurrenceStopsAtEndDateAndAtPeriodEnd() {
        KpiTaskResponse withEnd = weekly("Có ngày kết thúc", FIRST_FRIDAY, FIRST_FRIDAY.plusDays(3));
        loginAs(employee);
        done(withEnd, false);
        assertThat(seriesIds(withEnd.getId())).hasSize(1);

        // Thứ 6 cuối cùng trước khi đợt kết thúc (31/03/2099): lần kế tiếp rơi ra ngoài đợt ⇒ dừng.
        LocalDate lastFriday = LocalDate.of(2099, 3, 31).with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY));
        KpiTaskResponse atEnd = weekly("Cuối đợt", lastFriday, null);
        loginAs(employee);
        done(atEnd, false);
        assertThat(seriesIds(atEnd.getId())).hasSize(1);
    }

    @Test
    void d7_editThisAndFollowingOnlyChangesUnfinishedOccurrences() {
        KpiTaskResponse first = weekly("Tên cũ", FIRST_FRIDAY, null);
        loginAs(employee);
        done(first, false);
        UUID secondId = seriesIds(first.getId()).get(1);
        KpiTaskResponse second = taskService.get(secondId);

        taskService.update(secondId, UpdateKpiTaskRequest.builder().version(second.getVersion()).title("Tên mới").scope("FOLLOWING").build());
        done(taskService.get(secondId), false);
        List<UUID> series = seriesIds(first.getId());
        assertThat(taskService.get(series.get(0)).getTitle()).isEqualTo("Tên cũ");  // lần đã xong không đổi
        assertThat(taskService.get(series.get(2)).getTitle()).isEqualTo("Tên mới"); // các lần sau theo bản mẫu mới

        // "Chỉ lần này": lần 3 đổi tên, lần 4 vẫn dùng bản mẫu.
        KpiTaskResponse third = taskService.get(series.get(2));
        taskService.update(third.getId(), UpdateKpiTaskRequest.builder().version(third.getVersion()).title("Riêng lần 3").scope("THIS").build());
        done(taskService.get(third.getId()), false);
        assertThat(taskService.get(seriesIds(first.getId()).get(3)).getTitle()).isEqualTo("Tên mới");
    }

    // ── 8. Việc con ───────────────────────────────────────────────────────────────────────────

    @Test
    void d8_subtaskProgressAndCompletingParentNeedsConfirmation() {
        KpiTaskResponse parent = create(employee, base("Việc cha").build());
        loginAs(employee);
        KpiTaskResponse a = taskService.create(CreateKpiTaskRequest.builder().parentTaskId(parent.getId()).title("Con A").build());
        KpiTaskResponse b = taskService.create(CreateKpiTaskRequest.builder().parentTaskId(parent.getId()).title("Con B").build());
        taskService.create(CreateKpiTaskRequest.builder().parentTaskId(parent.getId()).title("Con C").build());
        done(a, false);
        taskService.changeStatus(b.getId(), ChangeKpiTaskStatusRequest.builder().status(KpiTaskStatus.CANCELLED).version(b.getVersion()).build());

        KpiTaskResponse p = taskService.get(parent.getId());
        assertThat(p.getSubtaskDone()).isEqualTo(1);
        assertThat(p.getSubtaskTotal()).isEqualTo(2);          // việc con đã huỷ không tính
        assertThat(p.getSubtasks()).hasSize(3);
        assertThat(p.getSubtasks().get(0).getKpiId()).isEqualTo(kpiId); // cùng KPI với việc cha

        assertThatThrownBy(() -> done(p, false))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_PARENT_HAS_OPEN_SUBTASKS));
        assertThat(done(taskService.get(parent.getId()), true).getStatus()).isEqualTo(KpiTaskStatus.DONE);

        // Việc con không có việc con.
        assertThatThrownBy(() -> taskService.create(CreateKpiTaskRequest.builder().parentTaskId(a.getId()).title("Cháu").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_SUBTASK_NESTED));
    }

    // ── 9. Nhắc trước 1 giờ ───────────────────────────────────────────────────────────────────

    @Test
    void d9_reminderOneHourBeforeIsSentExactlyOnce() {
        LocalDateTime dueAt = LocalDateTime.now(KpiTaskService.ZONE).plusMinutes(30).withSecond(0).withNano(0);
        KpiTaskResponse t = create(employee, base("Họp lúc sắp tới").dueDate(dueAt.toLocalDate()).dueTime(dueAt.toLocalTime())
                .reminders(List.of(KpiTaskReminderInput.builder().kind(KpiTaskReminderKind.BEFORE).offsetMinutes(60).build()))
                .build());
        Instant now = Instant.now();
        new TransactionTemplate(txManager).executeWithoutResult(s -> scheduler.sendReminders(now));
        new TransactionTemplate(txManager).executeWithoutResult(s -> scheduler.sendReminders(now.plusSeconds(300)));
        Long n = jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND reference_id = ? AND type = 'TASK'",
                Long.class, employee, t.getId());
        assertThat(n).isEqualTo(1L);
        loginAs(employee);
        assertThat(taskService.get(t.getId()).getReminders()).singleElement()
                .satisfies(r -> assertThat(r.getSentAt()).isNotNull());
    }

    // ── 10–11. Lịch, thêm nhanh theo nhóm ─────────────────────────────────────────────────────

    @Test
    void d10_movingTaskOnCalendarChangesDueDate_lockedCycleBlocksIt() {
        KpiTaskResponse t = create(employee, base("Kéo trên lịch").dueDate(FIRST_FRIDAY).build());
        loginAs(employee);
        KpiTaskResponse moved = taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(t.getVersion())
                .dueDate(FIRST_FRIDAY.plusDays(3)).build());
        assertThat(moved.getDueDate()).isEqualTo(FIRST_FRIDAY.plusDays(3));
        assertThat(taskService.list(new KpiTaskService.ListQuery("ASSIGNED", null, null, null, null, null, null,
                FIRST_FRIDAY.plusDays(3), FIRST_FRIDAY.plusDays(3), null, null, false, 0, 50)).getContent())
                .extracting(KpiTaskResponse::getId).containsExactly(t.getId());

        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);
        assertThatThrownBy(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(moved.getVersion())
                .dueDate(FIRST_FRIDAY.plusDays(4)).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.CYCLE_LOCKED));
    }

    @Test
    void d11_quickAddInTodayGroupSetsTodayAndInKpiGroupSetsKpi() {
        LocalDate today = KpiTaskService.today();
        KpiTaskResponse t = create(employee, base("Thêm nhanh hôm nay").dueDate(today).build());
        assertThat(t.getDueBucket()).isEqualTo(KpiTaskResponse.DueBucket.TODAY);
        loginAs(employee);
        assertThat(taskService.list(new KpiTaskService.ListQuery("ASSIGNED", null, null, null, null, null, "TODAY",
                null, null, null, null, false, 0, 50)).getContent()).extracting(KpiTaskResponse::getId).contains(t.getId());

        UUID otherKpi = newKpi("KPI X", "APPROVED", head, employee);
        KpiTaskResponse inKpi = create(employee, CreateKpiTaskRequest.builder().kpiId(otherKpi).title("Thêm trong nhóm KPI X").build());
        loginAs(employee);
        assertThat(taskService.list(new KpiTaskService.ListQuery("ASSIGNED", otherKpi, null, null, null, null, null,
                null, null, null, null, false, 0, 50)).getContent()).extracting(KpiTaskResponse::getId).containsExactly(inKpi.getId());
    }

    // ── 12–13. Sửa đè, khoá kỳ ───────────────────────────────────────────────────────────────

    @Test
    void d12_secondConcurrentEditGetsConflict() {
        KpiTaskResponse t = create(head, base("Hai người cùng sửa").ownerId(employee).build());
        // Người tạo (trưởng) và người phụ trách (nhân viên) cùng mở bản version hiện tại.
        loginAs(employee);
        taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(t.getVersion()).title("Nhân viên sửa").build());
        loginAs(head);
        assertThatThrownBy(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(t.getVersion()).title("Trưởng sửa").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_VERSION_CONFLICT));
    }

    @Test
    void d13_lockedCycleBlocksEveryWriteOnTaskSubtaskChecklist() {
        KpiTaskResponse t = create(employee, base("Trước khoá").dueDate(FIRST_FRIDAY).checklist(List.of("Bước")).build());
        loginAs(employee);
        KpiTaskResponse sub = taskService.create(CreateKpiTaskRequest.builder().parentTaskId(t.getId()).title("Con").build());
        KpiTaskResponse d = taskService.get(t.getId());
        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);

        assertLocked(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(d.getVersion()).title("x").build()));
        assertLocked(() -> done(d, true));
        assertLocked(() -> taskService.create(CreateKpiTaskRequest.builder().parentTaskId(t.getId()).title("Con mới").build()));
        assertLocked(() -> taskService.changeStatus(sub.getId(), ChangeKpiTaskStatusRequest.builder().status(KpiTaskStatus.DONE).version(sub.getVersion()).build()));
        assertLocked(() -> taskService.addChecklistItem(t.getId(), KpiTaskChecklistRequest.builder().title("Thêm").build()));
        assertLocked(() -> taskService.updateChecklistItem(t.getId(), d.getChecklist().get(0).getId(), KpiTaskChecklistRequest.builder().done(true).build()));
        assertLocked(() -> taskService.addFollower(t.getId(), colleague));
        assertLocked(() -> taskService.setReminders(t.getId(), List.of()));
        assertLocked(() -> taskService.duplicate(t.getId()));
        assertLocked(() -> taskService.delete(t.getId()));
        assertThat(taskService.get(t.getId()).getReadOnlyReason()).isEqualTo(KpiTaskResponse.ReadOnlyReason.CYCLE_LOCKED);
    }

    private void assertLocked(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.CYCLE_LOCKED));
    }

    private KpiTaskService.ListQuery query(String view) {
        return new KpiTaskService.ListQuery(view, null, null, null, null, null, null, null, null, null, null, false, 0, 200);
    }

    private long waitNotificationCount(UUID userId, UUID referenceId, long expected) throws InterruptedException {
        long n = 0;
        for (int i = 0; i < 50; i++) {
            n = jdbc.queryForObject("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND reference_id = ?",
                    Long.class, userId, referenceId);
            if (n >= expected) return n;
            Thread.sleep(200);
        }
        return n;
    }
}
