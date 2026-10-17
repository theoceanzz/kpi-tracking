package com.kpitracking.service.task;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.kpitracking.enums.task.KpiTaskEventAction;
import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.TaskListRole;
import com.kpitracking.event.TaskListEvents;
import com.kpitracking.i18n.LocalizedText;

import com.kpitracking.service.notification.NotificationDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.*;

import com.kpitracking.entity.access.Scope;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.TaskFieldValue;
import com.kpitracking.entity.task.TaskList;
import com.kpitracking.entity.task.TaskListAutomation;
import com.kpitracking.entity.task.TaskListItem;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.task.KpiTaskAssigneeRepository;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.task.TaskFieldValueRepository;
import com.kpitracking.repository.task.TaskListAutomationRepository;
import com.kpitracking.repository.task.TaskListItemRepository;
import com.kpitracking.repository.task.TaskListRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
/**
 * Chạy luật tự động hoá của danh sách công việc ({@link TaskAutomationRule}) SAU COMMIT, mỗi lượt một transaction riêng.
 *
 * <ul>
 *   <li>Hành động chạy DƯỚI TÊN người tạo luật, và chỉ khi người đó còn là biên tập danh sách, sửa được việc (việc có
 *       KPI: theo luật KPI — danh sách không cấp quyền) và kỳ chưa khoá. Không đủ quyền ⇒ bỏ qua lặng lẽ.</li>
 *   <li>Chặn vòng lặp: một lượt do tự động hoá gây ra mang độ sâu +1; tối đa {@link #MAX_DEPTH} tầng.</li>
 *   <li>Chỉ áp cho việc GỐC (việc trong danh sách); việc con đổi trạng thái không kích hoạt.</li>
 * </ul>
 * Lỗi của một luật không làm hỏng thao tác gốc (đã commit) hay các luật khác — chỉ ghi log.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TaskAutomationRunner {

    static final int MAX_DEPTH = 3;
    private static final ThreadLocal<Integer> DEPTH = ThreadLocal.withInitial(() -> 0);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final TaskListAutomationRepository automationRepository;
    private final TaskListRepository listRepository;
    private final TaskListItemRepository itemRepository;
    private final TaskFieldValueRepository fieldValueRepository;
    private final KpiTaskRepository taskRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final TaskListAccess listAccess;
    private final KpiTaskAccess access;
    private final KpiTaskService taskService;
    private final TaskListService listService;
    private final NotificationDispatcher dispatcher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onItemAdded(TaskListEvents.ItemAdded e) {
        run(e.listId(), e.taskId(), r -> "TASK_ADDED".equals(r.get("type")));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSectionChanged(TaskListEvents.SectionChanged e) {
        run(e.listId(), e.taskId(), r -> "SECTION_ENTERED".equals(r.get("type"))
                && e.sectionId() != null && e.sectionId().toString().equals(String.valueOf(r.get("sectionId"))));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onStatusChanged(TaskListEvents.StatusChanged e) {
        KpiTask task = taskRepository.findById(e.taskId()).orElse(null);
        if (task == null || !task.isRoot()) return;
        for (TaskListItem item : itemRepository.findByTaskId(task.getId())) {
            run(item.getListId(), task.getId(), r -> ("STATUS_CHANGED".equals(r.get("type")) && e.to().name().equals(r.get("status")))
                    || ("COMPLETED".equals(r.get("type")) && e.to() == KpiTaskStatus.DONE));
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onFieldChanged(TaskListEvents.FieldChanged e) {
        TaskFieldValue v = fieldValueRepository.findById(new TaskFieldValue.Key(e.taskId(), e.fieldId())).orElse(null);
        Object current = v == null ? null : TaskFieldCodec.unwrap(v.getValue());
        run(e.listId(), e.taskId(), r -> {
            if (!"FIELD_CHANGED".equals(r.get("type")) || !e.fieldId().toString().equals(String.valueOf(r.get("fieldId")))) return false;
            Object option = r.get("optionId");
            if (option == null) return true;
            if (current instanceof Collection<?> c) return c.stream().anyMatch(x -> option.toString().equals(String.valueOf(x)));
            return option.toString().equals(String.valueOf(current));
        });
    }

    private void run(UUID listId, UUID taskId, java.util.function.Predicate<Map<String, Object>> matches) {
        int depth = DEPTH.get();
        if (depth >= MAX_DEPTH) {
            log.debug("Tự động hoá: dừng ở tầng {} (việc {})", depth, taskId);
            return;
        }
        TaskList list = listRepository.findById(listId).orElse(null);
        if (list == null || list.getArchivedAt() != null) return;
        List<TaskListAutomation> rules = automationRepository.findByListIdInAndEnabledTrue(List.of(listId));
        if (rules.isEmpty()) return;
        DEPTH.set(depth + 1);
        try {
            for (TaskListAutomation rule : rules) {
                Map<String, Object> trigger = read(rule.getTrigger());
                if (!matches.test(trigger)) continue;
                try {
                    if (execute(rule, list, taskId)) automationRepository.markRun(rule.getId(), Instant.now());
                } catch (Exception ex) {
                    log.info("Tự động hoá '{}' bỏ qua việc {}: {}", rule.getName(), taskId, ex.getMessage());
                }
            }
        } finally {
            DEPTH.set(depth);
        }
    }

    /** Trả true nếu đã làm gì đó. */
    private boolean execute(TaskListAutomation rule, TaskList list, UUID taskId) {
        User actor = userRepository.findById(rule.getCreatedBy()).orElse(null);
        KpiTask task = taskRepository.findById(taskId).orElse(null);
        if (actor == null || task == null) return false;
        TaskListRole role = listAccess.roleOf(actor.getId(), list.getId());
        if (role == null || !role.atLeast(TaskListRole.EDITOR)) return false;
        KpiTaskAccess.Scope scope = access.scope(actor.getId(), List.of(task));
        Map<String, Object> action = read(rule.getAction());
        String type = TaskAutomationRule.str(action, "type");
        if (!"NOTIFY".equals(type) && !"MOVE_SECTION".equals(type) && !scope.canEdit(task)) return false;
        switch (type == null ? "" : type) {
            case "SET_STATUS" -> {
                KpiTaskStatus status = KpiTaskStatus.valueOf(TaskAutomationRule.str(action, "status"));
                if (status == task.getStatus()) return false;
                taskService.applyStatus(actor, task, status, null, false);
            }
            case "MOVE_SECTION" -> {
                if (!scope.canView(task)) return false;
                listService.moveItemInternal(actor, list.getId(), task, TaskAutomationRule.uuid(action, "sectionId"), true, null);
            }
            case "ADD_ASSIGNEE" -> {
                if (!scope.canReassign(task)) return false;
                taskService.addAssigneeInternal(actor, task, TaskAutomationRule.uuid(action, "userId"));
            }
            case "ADD_FOLLOWER" -> taskService.addFollowerInternal(actor, task, TaskAutomationRule.uuid(action, "userId"));
            case "SET_PRIORITY" -> taskService.setPriorityInternal(actor, task, KpiTaskPriority.valueOf(TaskAutomationRule.str(action, "priority")));
            case "SET_FIELD" -> taskService.writeFieldValue(actor, task, list.getId(), TaskAutomationRule.uuid(action, "fieldId"), action.get("value"));
            case "SET_DUE_IN_DAYS" -> taskService.setDueInternal(actor, task,
                    KpiTaskService.today().plusDays(Integer.parseInt(TaskAutomationRule.str(action, "days"))));
            case "NOTIFY" -> notify(rule, list, task, action);
            default -> {
                return false;
            }
        }
        taskService.log(task, actor, KpiTaskEventAction.AUTOMATION_RAN, null, rule.getName());
        return true;
    }

    private void notify(TaskListAutomation rule, TaskList list, KpiTask task, Map<String, Object> action) {
        String target = TaskAutomationRule.str(action, "target");
        Set<UUID> to = new LinkedHashSet<>();
        if ("ASSIGNEES".equals(target)) to.addAll(assigneeRepository.findUserIds(task.getId()));
        else if ("CREATOR".equals(target)) to.add(task.getCreatedBy());
        else to.add(TaskAutomationRule.uuid(action, "target"));
        KpiTaskAccess.Scope[] holder = new KpiTaskAccess.Scope[1];
        for (User u : userRepository.findAllById(to)) {
            // Chỉ báo người xem được việc — luật không được mở đường lộ việc.
            holder[0] = access.scope(u.getId(), List.of(task));
            if (!holder[0].canView(task)) continue;
            OrgUnit unit = userRoleOrgUnitRepository.findByUserId(u.getId()).stream().map(UserRoleOrgUnit::getOrgUnit).findFirst().orElse(null);
            dispatcher.dispatchInAppOnly(list.getOrganizationId(), "task_automation", u, unit,
                    LocalizedText.of("notif.task.automation.title"),
                    LocalizedText.of("notif.task.automation.message", rule.getName(), list.getName(), task.getTitle()),
                    "TASK", task.getId());
        }
    }

    private static Map<String, Object> read(String json) {
        try {
            return json == null ? Map.of() : JSON.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}
