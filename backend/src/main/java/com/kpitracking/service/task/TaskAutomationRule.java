package com.kpitracking.service.task;

import com.kpitracking.entity.TaskList;
import com.kpitracking.entity.TaskListField;
import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.TaskListFieldRepository;
import com.kpitracking.repository.TaskListSectionRepository;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * Luật tự động hoá của danh sách công việc: "khi … thì …". Lưu dạng JSON ở {@code task_list_automations}.
 *
 * <p>Khi ({@code trigger.type}): TASK_ADDED · SECTION_ENTERED ({@code sectionId}) · STATUS_CHANGED ({@code status}) ·
 * COMPLETED · FIELD_CHANGED ({@code fieldId}, tuỳ chọn {@code optionId}).
 * <br>Thì ({@code action.type}): SET_STATUS ({@code status}) · MOVE_SECTION ({@code sectionId}) · ADD_ASSIGNEE
 * ({@code userId} — chỉ việc không KPI) · ADD_FOLLOWER ({@code userId}) · SET_PRIORITY ({@code priority}) · SET_FIELD
 * ({@code fieldId}, {@code value}) · SET_DUE_IN_DAYS ({@code days}) · NOTIFY ({@code target}: ASSIGNEES | CREATOR | id người).
 */
public final class TaskAutomationRule {

    public static final Set<String> TRIGGERS = Set.of("TASK_ADDED", "SECTION_ENTERED", "STATUS_CHANGED", "COMPLETED", "FIELD_CHANGED");
    public static final Set<String> ACTIONS = Set.of("SET_STATUS", "MOVE_SECTION", "ADD_ASSIGNEE", "ADD_FOLLOWER", "SET_PRIORITY",
            "SET_FIELD", "SET_DUE_IN_DAYS", "NOTIFY");

    private TaskAutomationRule() {}

    public static String str(Map<String, Object> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v == null ? null : v.toString();
    }

    public static UUID uuid(Map<String, Object> m, String key) {
        String s = str(m, key);
        try {
            return s == null ? null : UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Kiểm luật trước khi lưu: kiểu hợp lệ, nhóm / trường thuộc đúng danh sách, người cùng tổ chức. */
    public static void validate(TaskList list, Map<String, Object> trigger, Map<String, Object> action,
                                TaskListSectionRepository sections, TaskListFieldRepository fields, Predicate<UUID> userInOrg) {
        String t = str(trigger, "type"), a = str(action, "type");
        if (t == null || a == null || !TRIGGERS.contains(t) || !ACTIONS.contains(a)) throw invalid();
        switch (t) {
            case "SECTION_ENTERED" -> requireSection(list, uuid(trigger, "sectionId"), sections);
            case "STATUS_CHANGED" -> requireEnum(KpiTaskStatus.class, str(trigger, "status"));
            case "FIELD_CHANGED" -> requireField(list, uuid(trigger, "fieldId"), fields);
            default -> { }
        }
        switch (a) {
            case "SET_STATUS" -> requireEnum(KpiTaskStatus.class, str(action, "status"));
            case "MOVE_SECTION" -> requireSection(list, uuid(action, "sectionId"), sections);
            case "ADD_ASSIGNEE", "ADD_FOLLOWER" -> {
                UUID u = uuid(action, "userId");
                if (u == null || !userInOrg.test(u)) throw invalid();
            }
            case "SET_PRIORITY" -> requireEnum(KpiTaskPriority.class, str(action, "priority"));
            case "SET_FIELD" -> requireField(list, uuid(action, "fieldId"), fields);
            case "SET_DUE_IN_DAYS" -> {
                try {
                    int d = Integer.parseInt(str(action, "days"));
                    if (d < 0 || d > 365) throw invalid();
                } catch (NumberFormatException e) {
                    throw invalid();
                }
            }
            case "NOTIFY" -> {
                String target = str(action, "target");
                if (target == null) throw invalid();
                if (!"ASSIGNEES".equals(target) && !"CREATOR".equals(target)) {
                    UUID u = uuid(action, "target");
                    if (u == null || !userInOrg.test(u)) throw invalid();
                }
            }
            default -> throw invalid();
        }
        // Chặn luật tự gọi lại ngay chính nó (vd. vào nhóm X ⇒ chuyển sang nhóm X).
        if ("SECTION_ENTERED".equals(t) && "MOVE_SECTION".equals(a)
                && String.valueOf(trigger.get("sectionId")).equals(String.valueOf(action.get("sectionId")))) throw invalid();
    }

    private static void requireSection(TaskList list, UUID id, TaskListSectionRepository sections) {
        if (id == null || sections.findById(id).filter(s -> s.getListId().equals(list.getId())).isEmpty()) throw invalid();
    }

    private static TaskListField requireField(TaskList list, UUID id, TaskListFieldRepository fields) {
        return fields.findById(id == null ? new UUID(0, 0) : id).filter(f -> f.getListId().equals(list.getId()))
                .orElseThrow(TaskAutomationRule::invalid);
    }

    private static <E extends Enum<E>> void requireEnum(Class<E> type, String value) {
        try {
            Enum.valueOf(type, value);
        } catch (Exception e) {
            throw invalid();
        }
    }

    private static BusinessException invalid() {
        return new BusinessException(ErrorCode.TASK_AUTOMATION_INVALID);
    }
}
