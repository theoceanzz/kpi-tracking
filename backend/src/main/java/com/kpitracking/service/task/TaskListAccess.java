package com.kpitracking.service.task;

import com.kpitracking.entity.TaskList;
import com.kpitracking.enums.TaskListRole;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.TaskListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Vai trò của một người trên danh sách công việc: thành viên trực tiếp hoặc qua đơn vị (gồm đơn vị con); nhiều đường vào
 * thì vai trò cao nhất thắng. {@code OWNER} quản lý danh sách; {@code EDITOR} thêm / bớt / sửa việc không KPI trong danh
 * sách; {@code VIEWER} xem. Danh sách KHÔNG cấp quyền gì trên việc gắn KPI hay việc riêng tư (docs/TASKS_DESIGN.md §4).
 */
@Component
@RequiredArgsConstructor
public class TaskListAccess {

    private final TaskListRepository listRepository;

    /** Mọi danh sách người này có vai trò. */
    public Map<UUID, TaskListRole> rolesOf(UUID userId) {
        return fold(listRepository.rolesOf(userId));
    }

    public Map<UUID, TaskListRole> rolesOf(UUID userId, Collection<UUID> listIds) {
        if (listIds == null || listIds.isEmpty()) return Map.of();
        return fold(listRepository.rolesOfIn(userId, listIds));
    }

    public TaskListRole roleOf(UUID userId, UUID listId) {
        return rolesOf(userId, List.of(listId)).get(listId);
    }

    public TaskListRole require(UUID userId, TaskList list, TaskListRole min) {
        TaskListRole role = roleOf(userId, list.getId());
        if (role == null) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_VIEW);
        if (!role.atLeast(min)) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_EDIT);
        return role;
    }

    private static Map<UUID, TaskListRole> fold(List<Object[]> rows) {
        Map<UUID, TaskListRole> out = new HashMap<>();
        for (Object[] r : rows) {
            UUID id = r[0] instanceof UUID u ? u : UUID.fromString(r[0].toString());
            out.merge(id, TaskListRole.valueOf(r[1].toString()), TaskListRole::max);
        }
        return out;
    }
}
