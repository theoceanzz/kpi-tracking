package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.task.KpiTaskEventResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskFollowerRemovalResponse;
import com.kpitracking.enums.task.KpiTaskEventAction;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.task.KpiTaskFollowerRepository;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Đổi KPI của việc (giao lại kèm KPI mới, hoặc "Chuyển sang KPI khác") mà người theo dõi không xem được KPI mới: xem
 * trước liệt kê ai bị gỡ khỏi việc nào (cả việc con), chỉ gỡ khi đã xác nhận (thực tế ⊆ đã xác nhận), ghi lịch sử kèm
 * lý do + người làm, báo người bị gỡ một lần.
 *
 * <p>Fixture ({@link CollabITSupport}): {@code colleague} cùng đơn vị xem được KPI đã duyệt {@code kpiId} nên theo dõi được
 * việc trên đó, nhưng KPI NHÁP {@link #draftKpi} chỉ người tạo ({@code head}) và người thực hiện ({@code employee}) xem được.
 * Chạy tay: {@code ./mvnw test -Dtest=KpiTaskFollowerKpiChangeIT}.
 */
class KpiTaskFollowerKpiChangeIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired KpiTaskFollowerRepository followerRepository;

    private UUID draftKpi;

    @BeforeEach
    void draftTarget() {
        draftKpi = newKpi("IT KPI nháp đích", "DRAFT", head, employee);
    }

    private KpiTaskResponse create(UUID as, CreateKpiTaskRequest req) {
        loginAs(as);
        return taskService.create(req);
    }

    /** Việc trên {@code kpiId} của {@code employee} (do {@code creator} tạo) + một việc con, đều có {@code colleague} theo dõi. */
    private UUID[] treeFollowedByColleague(UUID creator) {
        KpiTaskResponse parent = create(creator, CreateKpiTaskRequest.builder().kpiId(kpiId).title("Việc cha").ownerId(employee).build());
        KpiTaskResponse sub = create(employee, CreateKpiTaskRequest.builder().parentTaskId(parent.getId()).title("Việc con").build());
        loginAs(employee);
        taskService.addFollower(parent.getId(), colleague);
        taskService.addFollower(sub.getId(), colleague);
        return new UUID[]{parent.getId(), sub.getId()};
    }

    private static FollowerRemovalRef ref(UUID taskId, UUID userId) {
        return new FollowerRemovalRef(taskId, userId);
    }

    private static List<FollowerRemovalRef> refs(List<TaskFollowerRemovalResponse> impact) {
        return impact.stream().map(r -> ref(r.getTaskId(), r.getUserId())).toList();
    }

    private KpiTaskResponse assignToDraft(UUID taskId, List<FollowerRemovalRef> confirmed) {
        loginAs(head);
        long version = taskService.get(taskId).getVersion();
        return taskService.assign(taskId, AssignKpiTaskRequest.builder()
                .ownerId(employee).kpiId(draftKpi).version(version).confirmedFollowerRemovals(confirmed).build());
    }

    private boolean follows(UUID taskId, UUID userId) {
        return followerRepository.existsByTaskIdAndUserId(taskId, userId);
    }

    private UUID kpiOf(UUID taskId) {
        return jdbc.queryForObject("SELECT kpi_criteria_id FROM kpi_tasks WHERE id = ?", UUID.class, taskId);
    }

    /**
     * Thông báo "bị gỡ khỏi theo dõi" về các việc {@code taskIds} — chạy @Async sau commit, chờ tối đa 10 giây. Ca nào sinh
     * thông báo cũng phải chờ nó về: về sau lúc dọn dữ liệu thì nó nằm lại trong DB dev.
     */
    private List<String> waitRevokedNotifications(UUID userId, long expected, UUID... taskIds) throws InterruptedException {
        String in = String.join(",", java.util.Collections.nCopies(taskIds.length, "?"));
        Object[] args = new Object[taskIds.length + 1];
        args[0] = userId;
        System.arraycopy(taskIds, 0, args, 1, taskIds.length);
        List<String> msgs = List.of();
        for (int i = 0; i < 50; i++) {
            msgs = jdbc.queryForList("SELECT message_i18n FROM notifications WHERE user_id = ? AND type = 'TASK_FOLLOWER_REMOVED' "
                    + "AND reference_id IN (" + in + ")", String.class, args);
            if (msgs.size() >= expected) return msgs;
            Thread.sleep(200);
        }
        return msgs;
    }

    // ── Đường giao lại (assign) ───────────────────────────────────────────────────────────────

    @Test
    void assign_previewListsParentAndSubtask_blocksUntilConfirmed_thenRemovesLogsAndNotifiesOnce() throws Exception {
        UUID[] tree = treeFollowedByColleague(head);
        UUID parent = tree[0], sub = tree[1];
        loginAs(employee);
        taskService.addFollower(sub, head);   // head xem được KPI nháp (người tạo) ⇒ không bị gỡ

        loginAs(head);
        List<TaskFollowerRemovalResponse> impact = taskService.assignImpact(parent, draftKpi);
        assertThat(impact).extracting(TaskFollowerRemovalResponse::getTaskId, TaskFollowerRemovalResponse::getUserId,
                TaskFollowerRemovalResponse::isSubtask)
                .containsExactly(org.assertj.core.groups.Tuple.tuple(parent, colleague, false),
                        org.assertj.core.groups.Tuple.tuple(sub, colleague, true));
        assertThat(impact).allSatisfy(r -> assertThat(r.getUserName()).isNotBlank());

        // Chưa xác nhận ⇒ chặn, không đổi gì.
        assertThatThrownBy(() -> assignToDraft(parent, null))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FOLLOWER_REMOVAL_UNCONFIRMED));
        assertThat(kpiOf(parent)).isEqualTo(kpiId);
        assertThat(follows(parent, colleague)).isTrue();
        assertThat(follows(sub, colleague)).isTrue();

        KpiTaskResponse moved = assignToDraft(parent, refs(impact));
        assertThat(moved.getKpiId()).isEqualTo(draftKpi);
        assertThat(kpiOf(sub)).isEqualTo(draftKpi);
        assertThat(follows(parent, colleague)).isFalse();
        assertThat(follows(sub, colleague)).isFalse();
        assertThat(follows(sub, head)).isTrue();

        // Lịch sử của từng việc: ai bị gỡ, do đổi KPI, ai làm.
        String headName = userRepository.findById(head).orElseThrow().getFullName();
        String colleagueName = userRepository.findById(colleague).orElseThrow().getFullName();
        for (UUID id : tree) {
            assertThat(taskService.history(id)).anySatisfy(h -> {
                assertThat(h.getAction()).isEqualTo(KpiTaskEventAction.FOLLOWER_REMOVED);
                assertThat(h.getOldValue()).isEqualTo(colleagueName);
                assertThat(h.getNewValue()).isEqualTo(KpiTaskService.FOLLOWER_REMOVED_KPI_CHANGED);
                assertThat(h.getActorName()).isEqualTo(headName);
            });
        }

        // Một thông báo cho cả lượt (2 việc), không lộ tên KPI mới.
        assertThat(waitRevokedNotifications(colleague, 1, tree)).hasSize(1);
        Thread.sleep(1000);   // chờ thêm: không được có thông báo thứ hai cho việc con
        List<String> notes = waitRevokedNotifications(colleague, 1, tree);
        assertThat(notes).hasSize(1);
        assertThat(notes.get(0)).contains("notif.task.followerRevoked.messageMany").doesNotContain("IT KPI nháp đích");
    }

    // ── Luật so sánh khi gửi lại ──────────────────────────────────────────────────────────────

    @Test
    void confirmedListMayBeLarger_whenSomeoneUnfollowedMeanwhile() throws Exception {
        UUID[] tree = treeFollowedByColleague(head);
        loginAs(head);
        List<FollowerRemovalRef> confirmed = refs(taskService.assignImpact(tree[0], draftKpi));
        assertThat(confirmed).hasSize(2);

        // Giữa chừng colleague tự bỏ theo dõi việc con — gỡ tay, lịch sử không có lý do.
        loginAs(colleague);
        taskService.removeFollower(tree[1], colleague);

        assignToDraft(tree[0], confirmed);   // thực tế ⊂ đã xác nhận ⇒ cho qua
        assertThat(kpiOf(tree[0])).isEqualTo(draftKpi);
        assertThat(follows(tree[0], colleague)).isFalse();
        assertThat(waitRevokedNotifications(colleague, 1, tree)).singleElement()
                .satisfies(m -> assertThat(m).contains("notif.task.followerRevoked.message\""));

        loginAs(head);
        List<KpiTaskEventResponse> subHistory = taskService.history(tree[1]);
        assertThat(subHistory).filteredOn(h -> h.getAction() == KpiTaskEventAction.FOLLOWER_REMOVED).singleElement()
                .satisfies(h -> assertThat(h.getNewValue()).isNull());
    }

    @Test
    void newUnconfirmedFollowerAppearing_blocksTheChange() throws Exception {
        KpiTaskResponse parent = create(head, CreateKpiTaskRequest.builder().kpiId(kpiId).title("Việc cha").ownerId(employee).build());
        loginAs(employee);
        taskService.addFollower(parent.getId(), colleague);
        loginAs(head);
        List<FollowerRemovalRef> confirmed = refs(taskService.assignImpact(parent.getId(), draftKpi));
        assertThat(confirmed).containsExactly(ref(parent.getId(), colleague));

        // Sau khi xem trước, có thêm việc con và colleague theo dõi nó — cặp mới chưa ai xác nhận.
        KpiTaskResponse sub = create(employee, CreateKpiTaskRequest.builder().parentTaskId(parent.getId()).title("Việc con mới").build());
        loginAs(employee);
        taskService.addFollower(sub.getId(), colleague);

        assertThatThrownBy(() -> assignToDraft(parent.getId(), confirmed))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FOLLOWER_REMOVAL_UNCONFIRMED));
        assertThat(follows(parent.getId(), colleague)).isTrue();
        assertThat(kpiOf(parent.getId())).isEqualTo(kpiId);

        // Xác nhận lại cả cặp mới thì qua.
        assignToDraft(parent.getId(), List.of(ref(parent.getId(), colleague), ref(sub.getId(), colleague)));
        assertThat(follows(sub.getId(), colleague)).isFalse();
        assertThat(waitRevokedNotifications(colleague, 1, parent.getId(), sub.getId())).hasSize(1);
    }

    // ── Đường "Chuyển sang KPI khác" (move) ───────────────────────────────────────────────────

    @Test
    void move_previewIncludesSubtasks_blocksUntilConfirmed_thenRemovesAndLogsActor() throws Exception {
        UUID[] tree = treeFollowedByColleague(employee);
        KpiTaskResponse other = create(employee, CreateKpiTaskRequest.builder().kpiId(kpiId).title("Việc không ai theo dõi").build());

        loginAs(employee);
        List<TaskFollowerRemovalResponse> impact = taskService.moveImpact(kpiId, draftKpi, null);
        assertThat(impact).extracting(TaskFollowerRemovalResponse::getTaskId).containsExactly(tree[0], tree[1]);

        MoveKpiTasksRequest.MoveKpiTasksRequestBuilder req = MoveKpiTasksRequest.builder().fromKpiId(kpiId).toKpiId(draftKpi);
        assertThatThrownBy(() -> taskService.move(req.build()))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FOLLOWER_REMOVAL_UNCONFIRMED));
        assertThat(kpiOf(tree[0])).isEqualTo(kpiId);
        assertThat(kpiOf(other.getId())).isEqualTo(kpiId);

        assertThat(taskService.move(req.confirmedFollowerRemovals(refs(impact)).build())).isEqualTo(2);
        assertThat(kpiOf(tree[0])).isEqualTo(draftKpi);
        assertThat(kpiOf(tree[1])).isEqualTo(draftKpi);
        assertThat(kpiOf(other.getId())).isEqualTo(draftKpi);
        assertThat(follows(tree[0], colleague)).isFalse();
        assertThat(follows(tree[1], colleague)).isFalse();

        String employeeName = userRepository.findById(employee).orElseThrow().getFullName();
        assertThat(taskService.history(tree[1])).anySatisfy(h -> {
            assertThat(h.getAction()).isEqualTo(KpiTaskEventAction.FOLLOWER_REMOVED);
            assertThat(h.getNewValue()).isEqualTo(KpiTaskService.FOLLOWER_REMOVED_KPI_CHANGED);
            assertThat(h.getActorName()).isEqualTo(employeeName);
        });
        assertThat(waitRevokedNotifications(colleague, 1, tree)).hasSize(1);
    }

    @Test
    void move_withOnlyTaskIds_previewMatchesTheChosenTask() throws Exception {
        UUID[] tree = treeFollowedByColleague(employee);
        KpiTaskResponse other = create(employee, CreateKpiTaskRequest.builder().kpiId(kpiId).title("Việc thứ hai").build());
        loginAs(employee);
        taskService.addFollower(other.getId(), colleague);

        // Chọn đích danh việc thứ hai: chỉ cặp của nó; truyền id việc con thì bị bỏ qua (việc con đi theo việc cha).
        List<TaskFollowerRemovalResponse> impact = taskService.moveImpact(kpiId, draftKpi, List.of(other.getId(), tree[1]));
        assertThat(impact).extracting(TaskFollowerRemovalResponse::getTaskId).containsExactly(other.getId());
        taskService.move(MoveKpiTasksRequest.builder().fromKpiId(kpiId).toKpiId(draftKpi)
                .taskIds(List.of(other.getId(), tree[1])).confirmedFollowerRemovals(refs(impact)).build());
        assertThat(kpiOf(other.getId())).isEqualTo(draftKpi);
        assertThat(kpiOf(tree[1])).isEqualTo(kpiId);
        assertThat(follows(tree[0], colleague)).isTrue();
        assertThat(waitRevokedNotifications(colleague, 1, other.getId())).hasSize(1);
    }

    @Test
    void followersWhoCanViewTheNewKpi_areKept_andNoConfirmationIsNeeded() {
        UUID approvedTarget = newKpi("IT KPI đã duyệt đích", "APPROVED", head, employee);
        UUID[] tree = treeFollowedByColleague(head);

        loginAs(head);
        assertThat(taskService.assignImpact(tree[0], approvedTarget)).isEmpty();
        loginAs(employee);
        assertThat(taskService.moveImpact(kpiId, approvedTarget, null)).isEmpty();

        loginAs(head);
        KpiTaskResponse t = taskService.get(tree[0]);
        taskService.assign(tree[0], AssignKpiTaskRequest.builder().ownerId(employee).kpiId(approvedTarget).version(t.getVersion()).build());
        assertThat(kpiOf(tree[1])).isEqualTo(approvedTarget);
        assertThat(follows(tree[0], colleague)).isTrue();
        assertThat(follows(tree[1], colleague)).isTrue();
    }
}
