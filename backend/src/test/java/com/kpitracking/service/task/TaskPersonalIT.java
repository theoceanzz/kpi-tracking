package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.dto.response.task.TaskSidebarResponse;
import com.kpitracking.enums.task.TaskListRole;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cá nhân hoá Công việc (V42 §5) trên PostgreSQL THẬT: nhóm riêng trong "Việc của tôi" (chỉ của mình, chỉ việc mình xem
 * được), ghim / thư mục danh sách (riêng từng người), biểu tượng + bảng điều khiển danh sách (biên tập trở lên).
 * Chạy tay: {@code ./mvnw test -Dtest=TaskPersonalIT}.
 */
class TaskPersonalIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired TaskListService listService;
    @Autowired TaskMySectionService mySectionService;
    @Autowired TaskPresenceService presenceService;
    @Autowired TaskActivityService activityService;
    @Autowired TaskStructureService structureService;

    private Instant started;

    @BeforeEach
    void mark() {
        started = Instant.now().minusSeconds(1);
    }

    @AfterEach
    void cleanup() {
        for (UUID u : List.of(head, employee, colleague)) {
            jdbc.update("DELETE FROM task_my_sections WHERE user_id = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM kpi_tasks WHERE created_by = ? AND created_at >= ?) "
                    + "OR reference_id IN (SELECT id FROM task_lists WHERE created_by = ? AND created_at >= ?)",
                    u, java.sql.Timestamp.from(started), u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM kpi_tasks WHERE created_by = ? AND created_at >= ? AND kpi_criteria_id IS NULL", u, java.sql.Timestamp.from(started));
            jdbc.update("DELETE FROM task_lists WHERE created_by = ? AND created_at >= ?", u, java.sql.Timestamp.from(started));
        }
    }

    private KpiTaskResponse task(UUID as, String title, List<UUID> assignees) {
        loginAs(as);
        return taskService.create(CreateKpiTaskRequest.builder().title(title).assigneeIds(assignees).build());
    }

    @Test
    void mySections_arePrivate_andOnlyHoldTasksIcanView() {
        KpiTaskResponse mine = task(employee, "Việc của tôi", List.of(employee));
        loginAs(employee);
        TaskListResponses.MySection today = mySectionService.create(TaskListRequests.MySection.builder().name("Hôm nay").build());
        TaskListResponses.MySection later = mySectionService.create(TaskListRequests.MySection.builder().name("Để sau").build());
        assertThat(later.getSortOrder()).isGreaterThan(today.getSortOrder());

        KpiTaskResponse placed = mySectionService.assign(mine.getId(), TaskListRequests.MySectionAssign.builder().sectionId(today.getId()).build());
        assertThat(placed.getMySectionId()).isEqualTo(today.getId());
        // Chuyển nhóm / bỏ khỏi nhóm
        assertThat(mySectionService.assign(mine.getId(), TaskListRequests.MySectionAssign.builder().sectionId(later.getId()).build())
                .getMySectionId()).isEqualTo(later.getId());
        assertThat(mySectionService.assign(mine.getId(), TaskListRequests.MySectionAssign.builder().sectionId(null).build())
                .getMySectionId()).isNull();

        // Người khác không thấy, không dùng được nhóm của tôi
        loginAs(colleague);
        assertThat(mySectionService.list()).extracting(TaskListResponses.MySection::getId).doesNotContain(today.getId());
        KpiTaskResponse theirs = task(colleague, "Việc của đồng nghiệp", List.of(colleague));
        loginAs(colleague);
        assertThatThrownBy(() -> mySectionService.assign(theirs.getId(), TaskListRequests.MySectionAssign.builder().sectionId(today.getId()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_MY_SECTION_NOT_FOUND));
        assertThatThrownBy(() -> mySectionService.delete(today.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_MY_SECTION_NOT_FOUND));

        // Không xếp được việc mình không xem được (việc riêng của đồng nghiệp)
        loginAs(employee);
        assertThatThrownBy(() -> mySectionService.assign(theirs.getId(), TaskListRequests.MySectionAssign.builder().sectionId(today.getId()).build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW));

        // Xoá nhóm ⇒ việc về "chưa xếp nhóm"
        mySectionService.assign(mine.getId(), TaskListRequests.MySectionAssign.builder().sectionId(today.getId()).build());
        mySectionService.delete(today.getId());
        assertThat(taskService.get(mine.getId()).getMySectionId()).isNull();

        // Tên rỗng bị chặn
        assertThatThrownBy(() -> mySectionService.create(TaskListRequests.MySection.builder().name("  ").build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_MY_SECTION_INVALID));
    }

    @Test
    void listPrefs_arePerPerson_andIconDashboardFollowRoles() {
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("Dự án A").icon("🚀")
                .members(List.of(TaskListRequests.Member.builder().userId(colleague).role(TaskListRole.VIEWER).build())).build());
        assertThat(list.getIcon()).isEqualTo("🚀");

        listService.setMyPrefs(list.getId(), TaskListRequests.MyPrefs.builder().pinned(true).folder("Khách hàng").build());
        TaskSidebarResponse.ListCount own = sidebarRow(list.getId());
        assertThat(own.isPinned()).isTrue();
        assertThat(own.getFolder()).isEqualTo("Khách hàng");
        assertThat(own.getIcon()).isEqualTo("🚀");

        // Người khác không bị ảnh hưởng
        loginAs(colleague);
        TaskSidebarResponse.ListCount other = sidebarRow(list.getId());
        assertThat(other.isPinned()).isFalse();
        assertThat(other.getFolder()).isNull();

        // Bảng điều khiển: người xem (VIEWER) không lưu được, chủ lưu được
        assertThatThrownBy(() -> listService.setDashboard(list.getId(), TaskListRequests.Dashboard.builder().config(Map.of("widgets", List.of("status"))).build()))
                .isInstanceOf(RuntimeException.class);
        loginAs(employee);
        TaskListResponses.TaskListDetail saved = listService.setDashboard(list.getId(),
                TaskListRequests.Dashboard.builder().config(Map.of("widgets", List.of("status", "weekly"))).build());
        assertThat(saved.getDashboard()).isInstanceOf(Map.class);

        // Bỏ ghim + bỏ thư mục ⇒ không còn dòng tuỳ chọn
        listService.setMyPrefs(list.getId(), TaskListRequests.MyPrefs.builder().pinned(false).clearFolder(true).build());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM task_list_user_prefs WHERE list_id = ?", Long.class, list.getId())).isZero();
    }

    private TaskSidebarResponse.ListCount sidebarRow(UUID listId) {
        return taskService.sidebar().getLists().stream().filter(l -> l.getListId().equals(listId)).findFirst().orElseThrow();
    }

    @Test
    void presence_showsOtherViewers_onlyToPeopleWhoCanView() {
        KpiTaskResponse shared = task(employee, "Việc chung", List.of(employee, colleague));
        loginAs(employee);
        assertThat(presenceService.beat(shared.getId())).isEmpty();
        loginAs(colleague);
        assertThat(presenceService.beat(shared.getId())).extracting(TaskPresenceService.Viewer::userId).containsExactly(employee);
        loginAs(employee);
        assertThat(presenceService.beat(shared.getId())).extracting(TaskPresenceService.Viewer::userId).containsExactly(colleague);

        // Người không xem được việc: không báo, không thấy ai
        KpiTaskResponse mine = task(employee, "Việc riêng", List.of(employee));
        loginAs(colleague);
        assertThatThrownBy(() -> presenceService.beat(mine.getId()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_NO_PERMISSION_VIEW));

        // Rời đi ⇒ người kia hết thấy
        presenceService.leave(shared.getId());
        loginAs(employee);
        assertThat(presenceService.beat(shared.getId())).isEmpty();
        presenceService.leave(shared.getId());
    }

    @Test
    void activities_showOnlyMyTasks_andListFeedNeedsMembership() {
        KpiTaskResponse mine = task(employee, "Việc có hoạt động", List.of(employee));
        loginAs(employee);
        taskService.update(mine.getId(), com.kpitracking.dto.request.task.UpdateKpiTaskRequest.builder()
                .version(taskService.get(mine.getId()).getVersion()).title("Việc có hoạt động (sửa)").build());
        var feed = activityService.feed(null, 0, 50);
        assertThat(feed.getItems()).extracting(com.kpitracking.dto.response.task.TaskActivityResponse.Item::getTaskId).contains(mine.getId());
        assertThat(feed.getItems().get(0).getCreatedAt()).isAfterOrEqualTo(feed.getItems().get(feed.getItems().size() - 1).getCreatedAt());

        // Người không liên quan không thấy hoạt động của việc riêng này
        loginAs(colleague);
        assertThat(activityService.feed(null, 0, 50).getItems())
                .extracting(com.kpitracking.dto.response.task.TaskActivityResponse.Item::getTaskId).doesNotContain(mine.getId());

        // Hoạt động của danh sách: chỉ thành viên
        loginAs(employee);
        TaskListResponses.TaskListDetail list = listService.create(TaskListRequests.Upsert.builder().name("DS hoạt động").build());
        listService.addItem(list.getId(), TaskListRequests.Item.builder().taskId(mine.getId()).build());
        assertThat(activityService.feed(list.getId(), 0, 50).getItems()).isNotEmpty();
        loginAs(colleague);
        assertThatThrownBy(() -> activityService.feed(list.getId(), 0, 50))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_LIST_NO_PERMISSION_VIEW));
    }

    @Test
    void changeParent_movesWholeSubtree_andBlocksCyclesAndKpiMismatch() {
        KpiTaskResponse a = task(employee, "A", List.of(employee));
        KpiTaskResponse b = task(employee, "B", List.of(employee));
        loginAs(employee);
        KpiTaskResponse b1 = taskService.create(CreateKpiTaskRequest.builder().title("B1").parentTaskId(b.getId()).build());
        // B (kèm con B1) chuyển vào dưới A
        KpiTaskResponse moved = structureService.changeParent(b.getId(), a.getId(), taskService.get(b.getId()).getVersion());
        assertThat(moved.getParentTaskId()).isEqualTo(a.getId());
        assertThat(moved.getDepth()).isEqualTo(1);
        KpiTaskResponse child = taskService.get(b1.getId());
        assertThat(child.getDepth()).isEqualTo(2);
        assertThat(child.getRootTaskId()).isEqualTo(a.getId());
        // Không đặt được việc cha là con cháu của chính nó
        assertThatThrownBy(() -> structureService.changeParent(a.getId(), b1.getId(), null))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_PARENT_INVALID));
        // Chuyển thành việc độc lập: cả cây lên gốc
        KpiTaskResponse root = structureService.changeParent(b.getId(), null, null);
        assertThat(root.getParentTaskId()).isNull();
        assertThat(root.getDepth()).isZero();
        assertThat(taskService.get(b1.getId()).getDepth()).isEqualTo(1);
        // Khác KPI: chặn
        loginAs(head);
        KpiTaskResponse kpiTask = taskService.create(CreateKpiTaskRequest.builder().title("Việc KPI").kpiId(kpiId).assigneeIds(List.of(employee)).build());
        loginAs(employee);
        assertThatThrownBy(() -> structureService.changeParent(a.getId(), kpiTask.getId(), null))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_PARENT_KPI_MISMATCH));
        jdbc.update("DELETE FROM kpi_tasks WHERE id = ?", kpiTask.getId());
    }

    @Test
    void milestone_togglesAndIsLogged() {
        KpiTaskResponse a = task(employee, "Mốc", List.of(employee));
        loginAs(employee);
        assertThat(structureService.setMilestone(a.getId(), true, null).isMilestone()).isTrue();
        assertThat(taskService.history(a.getId())).extracting(com.kpitracking.dto.response.task.KpiTaskEventResponse::getAction)
                .contains(com.kpitracking.enums.task.KpiTaskEventAction.MILESTONE_CHANGED);
        assertThat(structureService.setMilestone(a.getId(), false, null).isMilestone()).isFalse();
        loginAs(colleague);
        assertThatThrownBy(() -> structureService.setMilestone(a.getId(), true, null)).isInstanceOf(RuntimeException.class);
    }
}
