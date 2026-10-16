package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.task.KpiTaskEventResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskFollowerRemovalResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.entity.TaskRecurrence;
import com.kpitracking.enums.*;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Công việc kiểu Lark đầy đủ (V42, docs/TASKS_DESIGN.md) trên PostgreSQL THẬT: KPI tuỳ chọn và các ĐƯỜNG LÁCH LUẬT khi
 * gắn / gỡ KPI, nhiều người thực hiện, từ chối, tab Đơn vị, danh sách (lọc không cấp quyền), trường tuỳ chỉnh, phụ thuộc,
 * thao tác hàng loạt, mẫu + tự động hoá, nhập Excel, và đối chiếu luật xem Java ↔ SQL.
 *
 * <p>Fixture ({@link CollabITSupport}): {@code head} (rank 0, TASK:ASSIGN, TASK:VIEW_TEAM), {@code employee},
 * {@code colleague} (rank 2, cùng đơn vị, không có quyền giao / xem đơn vị), {@code outsider} (tổ chức khác).
 * Chạy tay: {@code ./mvnw test -Dtest=TaskLarkFullIT}.
 */
class TaskLarkFullIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired TaskListService listService;
    @Autowired TaskBatchService batchService;
    @Autowired TaskTagService tagService;
    @Autowired TaskExcelService excelService;
    @Autowired KpiTaskAccess access;

    private Instant started;
    /** KPI NHÁP của employee: chỉ head (người tạo) và employee (người thực hiện) xem được. */
    private UUID draftKpi;

    @BeforeEach
    void mark() {
        started = Instant.now().minusSeconds(1);
        draftKpi = newKpi("IT KPI nháp", "DRAFT", head, employee);
    }

    /** Dọn việc KHÔNG KPI, danh sách, nhãn, chế độ xem, mẫu mà các ca tạo ra (lớp cha chỉ dọn theo KPI). */
    @AfterEach
    void cleanupNoKpi() {
        List<UUID> people = List.of(head, employee, colleague);
        for (UUID u : people) {
            jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM kpi_tasks WHERE created_by = ? AND created_at >= ?) "
                    + "OR reference_id IN (SELECT id FROM task_lists WHERE created_by = ? AND created_at >= ?)",
                    u, java.sql.Timestamp.from(started), u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM kpi_tasks WHERE created_by = ? AND created_at >= ? AND kpi_criteria_id IS NULL",
                    u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM task_lists WHERE created_by = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM task_tags WHERE created_by = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM task_saved_views WHERE owner_id = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM task_list_templates WHERE created_by = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
        }
    }

    private KpiTaskResponse create(UUID as, CreateKpiTaskRequest req) {
        loginAs(as);
        return taskService.create(req);
    }

    private CreateKpiTaskRequest.CreateKpiTaskRequestBuilder free(String title) {
        return CreateKpiTaskRequest.builder().title(title);
    }

    private long version(UUID taskId) {
        return taskService.get(taskId).getVersion();
    }

    private void lockCycle() {
        jdbc.update("UPDATE kpi_cycles SET status = 'LOCKED' WHERE id = ?", cycleId);
    }

    private void addKpiAssignee(UUID kpi, UUID user) {
        jdbc.update("INSERT INTO kpi_criteria_assignees (kpi_criteria_id, user_id) VALUES (?, ?)", kpi, user);
    }

    // ══ KPI tuỳ chọn + các đường lách luật ═══════════════════════════════════════════════════════

    @Test
    void noKpiTask_canBeAssignedAcrossTheOrganization_butNotOutsideIt() {
        // employee không có TASK:ASSIGN — trước đây không giao được cho ai; việc KHÔNG KPI thì giao được trong tổ chức.
        KpiTaskResponse t = create(employee, free("Hỗ trợ đồng nghiệp").assigneeIds(List.of(colleague)).build());
        assertThat(t.getKpiState()).isEqualTo("NONE");
        assertThat(t.getAssignees()).extracting(KpiTaskResponse.Assignee::getId).containsExactly(colleague);
        loginAs(colleague);
        assertThat(taskService.get(t.getId()).isCanDecline()).isTrue();

        assertThatThrownBy(() -> create(employee, free("Ra ngoài").assigneeIds(List.of(outsider)).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGNEE_NOT_IN_ORG));
    }

    @Test
    void bypass_createWithoutKpi_crossAssign_thenAttachKpi_isBlocked() {
        // Lách: tạo việc không KPI giao cho đồng nghiệp, rồi gắn KPI của mình vào.
        KpiTaskResponse t = create(employee, free("Lách luật").assigneeIds(List.of(colleague)).build());
        loginAs(employee);
        assertThatThrownBy(() -> taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(kpiId).version(t.getVersion()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH));

        // Kể cả khi đồng nghiệp CŨNG là người thực hiện KPI: employee không có TASK:ASSIGN ⇒ vẫn chặn.
        UUID shared = newKpi("KPI chung", "APPROVED", head, employee);
        addKpiAssignee(shared, colleague);
        assertThatThrownBy(() -> taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(shared).version(version(t.getId())).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGN_NOT_ALLOWED));
        assertThat(taskService.get(t.getId()).getKpiState()).isEqualTo("NONE");

        // Trưởng đơn vị (có TASK:ASSIGN, quản lý colleague) thì gắn được — đủ luật.
        jdbc.update("UPDATE kpi_tasks SET created_by = ? WHERE id = ?", head, t.getId());
        loginAs(head);
        KpiTaskResponse linked = taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(shared).version(version(t.getId())).build());
        assertThat(linked.getKpiId()).isEqualTo(shared);
        assertThat(taskService.history(t.getId())).extracting(KpiTaskEventResponse::getAction).contains(KpiTaskEventAction.KPI_LINKED);
    }

    @Test
    void bypass_unlinkKpiFromLockedCycle_isBlocked() {
        KpiTaskResponse t = create(employee, free("Việc của kỳ").kpiId(kpiId).build());
        lockCycle();
        loginAs(employee);
        assertThatThrownBy(() -> taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(null).version(t.getVersion()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.CYCLE_LOCKED));
        assertThat(jdbc.queryForObject("SELECT kpi_criteria_id FROM kpi_tasks WHERE id = ?", UUID.class, t.getId())).isEqualTo(kpiId);
    }

    @Test
    void bypass_attachKpiWithFollowerFromOutsideItsAudience_needsConfirmation() {
        KpiTaskResponse t = create(employee, free("Có người theo dõi").followerIds(List.of(colleague)).build());
        loginAs(employee);
        List<TaskFollowerRemovalResponse> impact = taskService.assignImpact(t.getId(), draftKpi);
        assertThat(impact).extracting(TaskFollowerRemovalResponse::getUserId).containsExactly(colleague);

        assertThatThrownBy(() -> taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(draftKpi).version(t.getVersion()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FOLLOWER_REMOVAL_UNCONFIRMED));

        KpiTaskResponse linked = taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(draftKpi).version(t.getVersion())
                .confirmedFollowerRemovals(List.of(new FollowerRemovalRef(t.getId(), colleague))).build());
        assertThat(linked.getFollowers()).isEmpty();
        jdbc.update("DELETE FROM kpi_tasks WHERE id = ?", t.getId());
    }

    @Test
    void deletedKpiTask_staysReadOnly_andCannotBeUnlinked_butCanMoveToAnotherKpi() {
        UUID soon = newKpi("KPI sẽ xoá", "APPROVED", head, employee);
        KpiTaskResponse t = create(employee, free("Việc của KPI sẽ xoá").kpiId(soon).build());
        jdbc.update("UPDATE kpi_criteria SET deleted_at = NOW() WHERE id = ?", soon);

        loginAs(employee);
        KpiTaskResponse seen = taskService.get(t.getId());
        assertThat(seen.getKpiState()).isEqualTo("DELETED");
        assertThat(seen.getReadOnlyReason()).isEqualTo(KpiTaskResponse.ReadOnlyReason.KPI_DELETED);
        assertThatThrownBy(() -> taskService.update(t.getId(), UpdateKpiTaskRequest.builder().version(seen.getVersion()).title("Sửa").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_DELETED_READONLY));
        assertThatThrownBy(() -> taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(null).version(seen.getVersion()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_KPI_DELETED_READONLY));

        KpiTaskResponse moved = taskService.setKpi(t.getId(), SetTaskKpiRequest.builder().kpiId(kpiId).version(seen.getVersion()).build());
        assertThat(moved.getKpiState()).isEqualTo("ACTIVE");
        jdbc.update("UPDATE kpi_criteria SET deleted_at = NULL WHERE id = ?", soon);
    }

    @Test
    void move_checksEveryAssigneeOfTheTree_notOnlyTheCaller() {
        // head tạo việc trên KPI của employee rồi chuyển sang KPI của chính head — employee không thuộc KPI đó.
        UUID headKpi = newKpi("KPI của trưởng", "APPROVED", head, head);
        KpiTaskResponse t = create(head, free("Giao cho nhân viên").kpiId(kpiId).assigneeIds(List.of(employee)).build());
        loginAs(head);
        assertThatThrownBy(() -> taskService.move(MoveKpiTasksRequest.builder().fromKpiId(kpiId).toKpiId(headKpi)
                .taskIds(List.of(t.getId())).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH));
    }

    // ══ Nhiều người thực hiện, kiểu hoàn thành, từ chối ══════════════════════════════════════════

    @Test
    void kpiTask_everyAssigneeMustBelongToTheKpi() {
        loginAs(head);
        assertThatThrownBy(() -> taskService.create(free("Hai người").kpiId(kpiId).assigneeIds(List.of(employee, colleague)).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH));
        addKpiAssignee(kpiId, colleague);
        KpiTaskResponse t = taskService.create(free("Hai người").kpiId(kpiId).assigneeIds(List.of(employee, colleague)).build());
        assertThat(t.getAssignees()).extracting(KpiTaskResponse.Assignee::getId).containsExactly(employee, colleague);
        assertThat(t.getAssignees().get(0).isPrimary()).isTrue();
    }

    @Test
    void completionAll_taskIsDoneOnlyWhenEveryAssigneeTicks_andRecurrenceSpawnsOnce() {
        LocalDate due = KpiTaskService.today().plusDays(1);
        KpiTaskResponse t = create(head, free("Cả nhóm cùng làm").assigneeIds(List.of(employee, colleague))
                .completionMode(TaskCompletionMode.ALL).dueDate(due)
                .recurrence(TaskRecurrence.builder().freq(TaskRecurrence.Freq.DAILY).interval(1).build()).build());

        loginAs(employee);
        KpiTaskResponse afterOne = taskService.changeStatus(t.getId(), ChangeKpiTaskStatusRequest.builder()
                .status(KpiTaskStatus.DONE).version(t.getVersion()).build());
        assertThat(afterOne.getStatus()).isEqualTo(KpiTaskStatus.IN_PROGRESS);
        assertThat(afterOne.isMyPartDone()).isTrue();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM kpi_tasks WHERE series_id = ?", Long.class, t.getId())).isLessThanOrEqualTo(1);

        loginAs(colleague);
        KpiTaskResponse done = taskService.changeStatus(t.getId(), ChangeKpiTaskStatusRequest.builder()
                .status(KpiTaskStatus.DONE).version(version(t.getId())).build());
        assertThat(done.getStatus()).isEqualTo(KpiTaskStatus.DONE);
        List<UUID> series = jdbc.queryForList("SELECT id FROM kpi_tasks WHERE series_id = ? ORDER BY series_index", UUID.class, t.getId());
        assertThat(series).hasSize(2);
        loginAs(head);
        KpiTaskResponse next = taskService.get(series.get(1));
        assertThat(next.getAssignees()).extracting(KpiTaskResponse.Assignee::getId).containsExactlyInAnyOrder(employee, colleague);
        assertThat(next.getAssignees()).allSatisfy(a -> assertThat(a.getCompletedAt()).isNull());
        assertThat(next.getCompletionMode()).isEqualTo(TaskCompletionMode.ALL);
    }

    @Test
    void decline_returnsTheTaskToTheAssigner_andIsOnlyForTasksWithoutKpi() throws Exception {
        KpiTaskResponse t = create(head, free("Việc đẩy sang").assigneeIds(List.of(employee)).build());
        loginAs(employee);
        taskService.decline(t.getId(), DeclineTaskRequest.builder().reason("Đang quá tải").build());
        loginAs(head);
        KpiTaskResponse back = taskService.get(t.getId());
        assertThat(back.getAssignees()).extracting(KpiTaskResponse.Assignee::getId).containsExactly(head);
        assertThat(back.getOwnerId()).isEqualTo(head);
        assertThat(taskService.history(t.getId())).anySatisfy(h -> {
            assertThat(h.getAction()).isEqualTo(KpiTaskEventAction.DECLINED);
            assertThat(h.getNewValue()).isEqualTo("Đang quá tải");
        });
        assertThat(waitNotifications(head, t.getId())).isPositive();

        KpiTaskResponse kpiTask = create(head, free("Việc gắn KPI").kpiId(kpiId).assigneeIds(List.of(employee)).build());
        loginAs(employee);
        assertThatThrownBy(() -> taskService.decline(kpiTask.getId(), DeclineTaskRequest.builder().build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_DECLINE_NOT_ALLOWED));
    }

    // ══ Tab Đơn vị, danh sách, đối chiếu luật xem ════════════════════════════════════════════════

    @Test
    void teamTab_showsPublicTasksWithoutKpiOfSubordinates_neverPrivateOnes() {
        KpiTaskResponse pub = create(employee, free("Việc công khai không KPI").build());
        KpiTaskResponse priv = create(employee, free("Việc riêng không KPI").visibility(KpiTaskVisibility.PRIVATE).build());
        loginAs(head);
        List<UUID> team = taskService.list(new KpiTaskService.ListQuery("TEAM", null, null, null, null, null, null, null, null,
                null, null, false, 0, 500)).getContent().stream().map(KpiTaskResponse::getId).toList();
        assertThat(team).contains(pub.getId()).doesNotContain(priv.getId());
        assertThat(access.canView(head, taskService.findTask(pub.getId()))).isTrue();
        assertThat(access.canView(head, taskService.findTask(priv.getId()))).isFalse();
        // colleague không có TASK:VIEW_TEAM.
        assertThat(access.canView(colleague, taskService.findTask(pub.getId()))).isFalse();
    }

    @Test
    void lists_grantViewOnlyForPublicTasksWithoutKpi_neverForKpiOrPrivateTasks() {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("Dự án IT")
                .members(List.of(TaskListRequests.Member.builder().userId(colleague).role(TaskListRole.VIEWER).build())).build());
        KpiTaskResponse open = create(employee, free("Việc chung").listId(list.getId()).build());
        KpiTaskResponse priv = create(employee, free("Việc riêng").visibility(KpiTaskVisibility.PRIVATE).listId(list.getId()).build());
        KpiTaskResponse kpiTask = create(employee, free("Việc có KPI nháp").kpiId(draftKpi).build());
        loginAs(employee);
        listService.addItem(list.getId(), TaskListRequests.Item.builder().taskId(kpiTask.getId()).build());

        assertThat(access.canView(colleague, taskService.findTask(open.getId()))).isTrue();
        assertThat(access.canView(colleague, taskService.findTask(priv.getId()))).isFalse();
        assertThat(access.canView(colleague, taskService.findTask(kpiTask.getId()))).isFalse();
        assertThat(access.canEdit(colleague, taskService.findTask(open.getId()))).isFalse();   // VIEWER

        loginAs(colleague);
        List<UUID> inList = taskService.list(listQuery(list.getId())).getContent().stream().map(KpiTaskResponse::getId).toList();
        assertThat(inList).containsExactly(open.getId());
        assertThat(listService.stats(list.getId()).getTotal()).isEqualTo(1);   // số đếm cũng không lộ việc khác
        jdbc.update("DELETE FROM kpi_tasks WHERE id = ?", kpiTask.getId());
    }

    @Test
    void visibilityParity_everySqlResultIsVisibleInJava_andEveryVisibleTaskWithoutKpiIsListed() {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("Đối chiếu")
                .members(List.of(TaskListRequests.Member.builder().userId(colleague).role(TaskListRole.EDITOR).build())).build());
        create(employee, free("Công khai trong danh sách").listId(list.getId()).build());
        create(employee, free("Riêng trong danh sách").visibility(KpiTaskVisibility.PRIVATE).listId(list.getId()).build());
        create(employee, free("Ngoài danh sách").build());
        create(head, free("Trưởng giao").assigneeIds(List.of(employee)).build());
        create(employee, free("Có KPI").kpiId(kpiId).build());

        for (UUID u : List.of(head, employee, colleague)) {
            loginAs(u);
            List<UUID> sql = taskService.list(new KpiTaskService.ListQuery("SEARCH", null, null, null, null, null, null, null, null,
                    null, null, false, 0, 500)).getContent().stream().map(KpiTaskResponse::getId).toList();
            for (UUID id : sql) assertThat(access.canView(u, taskService.findTask(id))).as("SQL ⊆ Java cho %s", u).isTrue();
            List<UUID> mine = jdbc.queryForList("SELECT id FROM kpi_tasks WHERE deleted_at IS NULL AND kpi_criteria_id IS NULL "
                    + "AND created_at >= ?", UUID.class, java.sql.Timestamp.from(started));
            for (UUID id : mine) {
                if (access.canView(u, taskService.findTask(id))) assertThat(sql).as("Java ⊆ SQL (không KPI) cho %s", u).contains(id);
            }
        }
    }

    private KpiTaskService.ListQuery listQuery(UUID listId) {
        return new KpiTaskService.ListQuery("LIST", null, null, null, null, null, null, null, null, null, "manual", true, 0, 500,
                listId, null, false, null, null, null, null, null, null);
    }

    // ══ Trường tuỳ chỉnh, phụ thuộc, việc con nhiều cấp ══════════════════════════════════════════

    @Test
    void customFields_validateAndFilterWithinAList() {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("Trường").build());
        list = listService.addField(list.getId(), TaskListRequests.Field.builder().name("Giai đoạn").type(TaskFieldType.SINGLE_SELECT)
                .options(List.of(TaskListRequests.Option.builder().id("a").label("A").build(),
                        TaskListRequests.Option.builder().id("b").label("B").build())).build());
        UUID field = list.getFields().get(0).getId();
        KpiTaskResponse a = create(employee, free("Giai đoạn A").listId(list.getId()).build());
        KpiTaskResponse b = create(employee, free("Giai đoạn B").listId(list.getId()).build());
        loginAs(employee);
        listService.setFieldValue(a.getId(), field, TaskListRequests.FieldValue.builder().value("a").build());
        listService.setFieldValue(b.getId(), field, TaskListRequests.FieldValue.builder().value("b").build());
        assertThatThrownBy(() -> listService.setFieldValue(a.getId(), field, TaskListRequests.FieldValue.builder().value("zzz").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FIELD_VALUE_INVALID));

        KpiTaskService.ListQuery q = new KpiTaskService.ListQuery("LIST", null, null, null, null, null, null, null, null, null,
                "manual", true, 0, 500, list.getId(), null, false, null, null,
                List.of(new TaskSearch.FieldFilter(field, null, "EQ", "b")), null, null, null);
        assertThat(taskService.list(q).getContent()).extracting(KpiTaskResponse::getId).containsExactly(b.getId());
        assertThat(taskService.get(a.getId()).getFieldValues()).extracting(KpiTaskResponse.FieldValue::getValue).containsExactly("a");
    }

    @Test
    void dependencies_blockCompletion_andCyclesAreRejected() {
        KpiTaskResponse a = create(employee, free("Làm trước").build());
        KpiTaskResponse b = create(employee, free("Làm sau").build());
        loginAs(employee);
        taskService.addDependency(b.getId(), a.getId());
        assertThat(taskService.get(b.getId()).getOpenBlockers()).isEqualTo(1);
        assertThatThrownBy(() -> taskService.changeStatus(b.getId(), ChangeKpiTaskStatusRequest.builder()
                .status(KpiTaskStatus.DONE).version(version(b.getId())).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_BLOCKED_BY_OPEN));
        assertThatThrownBy(() -> taskService.addDependency(a.getId(), b.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_DEPENDENCY_CYCLE));
        assertThat(taskService.changeStatus(b.getId(), ChangeKpiTaskStatusRequest.builder()
                .status(KpiTaskStatus.DONE).version(version(b.getId())).force(true).build()).getStatus()).isEqualTo(KpiTaskStatus.DONE);
    }

    @Test
    void grandchildOfAPrivateRoot_followsTheRootVisibility() {
        KpiTaskResponse root = create(employee, free("Gốc").build());
        KpiTaskResponse child = create(employee, free("Con").parentTaskId(root.getId()).build());
        KpiTaskResponse grand = create(employee, free("Cháu").parentTaskId(child.getId()).build());
        assertThat(grand.getDepth()).isEqualTo(2);
        assertThat(grand.getRootTaskId()).isEqualTo(root.getId());
        loginAs(head);
        assertThat(access.canView(head, taskService.findTask(grand.getId()))).isTrue();   // KPI_SCOPE, cấp dưới
        loginAs(employee);
        taskService.update(root.getId(), UpdateKpiTaskRequest.builder().version(root.getVersion()).visibility(KpiTaskVisibility.PRIVATE).build());
        assertThat(access.canView(head, taskService.findTask(grand.getId()))).isFalse();
    }

    // ══ Hàng loạt, mẫu + tự động hoá, nhãn, nhập Excel ═══════════════════════════════════════════

    @Test
    void batch_appliesPerTask_andReportsFailuresRowByRow() {
        KpiTaskResponse mine = create(employee, free("Của tôi").build());
        KpiTaskResponse other = create(colleague, free("Của đồng nghiệp").visibility(KpiTaskVisibility.PRIVATE).build());
        loginAs(employee);
        TaskListResponses.BatchResult r = batchService.run(TaskListRequests.Batch.builder().action("COMPLETE")
                .taskIds(List.of(mine.getId(), other.getId())).build());
        assertThat(r.getSucceeded()).isEqualTo(1);
        assertThat(r.getResults()).filteredOn(x -> !x.isOk()).singleElement()
                .satisfies(x -> assertThat(x.getCode()).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW.name()));
        assertThat(taskService.get(mine.getId()).getStatus()).isEqualTo(KpiTaskStatus.DONE);
    }

    @Test
    void builtinTemplate_buildsSectionsFieldsTasksAndAutomation_thatRuns() {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder()
                .builtinTemplate("project").includeSampleTasks(true).build());
        assertThat(list.getSections()).hasSize(4);
        assertThat(list.getFields()).hasSize(2);
        assertThat(listService.automations(list.getId())).hasSize(1);
        List<KpiTaskResponse> tasks = taskService.list(listQuery(list.getId())).getContent();
        assertThat(tasks).hasSize(3);

        // Luật mẫu: vào nhóm cuối ("Hoàn thành") ⇒ việc chuyển DONE.
        UUID doneSection = list.getSections().get(3).getId();
        KpiTaskResponse first = tasks.stream().filter(t -> t.getSubtaskTotal() == 0).findFirst().orElseThrow();
        listService.moveItem(list.getId(), TaskListRequests.Item.builder().taskId(first.getId()).sectionId(doneSection).build());
        assertThat(taskService.get(first.getId()).getStatus()).isEqualTo(KpiTaskStatus.DONE);
        assertThat(taskService.history(first.getId())).extracting(KpiTaskEventResponse::getAction).contains(KpiTaskEventAction.AUTOMATION_RAN);
    }

    @Test
    void tags_areSharedInTheOrganization_andFilterTheList() {
        loginAs(employee);
        TaskListResponses.Tag tag = tagService.create(TaskListRequests.Tag.builder().name("Khẩn").color("#ef4444").build());
        assertThat(tagService.create(TaskListRequests.Tag.builder().name("khẩn").build()).getId()).isEqualTo(tag.getId());
        KpiTaskResponse t = create(employee, free("Gắn nhãn").tagIds(List.of(tag.getId())).build());
        create(employee, free("Không nhãn").build());
        loginAs(employee);
        List<UUID> found = taskService.list(new KpiTaskService.ListQuery("INVOLVED", null, null, null, null, null, null, null, null,
                null, null, false, 0, 500, null, null, false, null, List.of(tag.getId()), null, null, null, null))
                .getContent().stream().map(KpiTaskResponse::getId).toList();
        assertThat(found).containsExactly(t.getId());
    }

    @Test
    void excelImport_previewThenCommit_createsTasksInTheList() throws Exception {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("Nhập").build());
        MockMultipartFile file = new MockMultipartFile("file", "t.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelService.importTemplate());
        TaskListResponses.ImportPreview preview = excelService.preview(list.getId(), file);
        assertThat(preview.getValidCount()).isEqualTo(1);
        TaskListResponses.ImportPreviewRow row = preview.getRows().get(0);
        TaskListResponses.ImportResult result = excelService.commit(list.getId(), TaskListRequests.ImportCommit.builder().rows(List.of(
                TaskListRequests.ImportRow.builder().title(row.getTitle()).dueDate(row.getDueDate()).startDate(row.getStartDate())
                        .priority(row.getPriority()).section(row.getSection()).tags(row.getTags()).build(),
                TaskListRequests.ImportRow.builder().title(" ").build())).build());
        assertThat(result.getCreated()).isEqualTo(1);
        assertThat(result.getFailed()).hasSize(1);
        List<KpiTaskResponse> tasks = taskService.list(listQuery(list.getId())).getContent();
        assertThat(tasks).hasSize(1);
        assertThat(tasks.get(0).getLists().get(0).getSectionName()).isEqualTo(row.getSection());
        assertThat(excelService.export(listQuery(list.getId()))).isNotEmpty();
    }
}
