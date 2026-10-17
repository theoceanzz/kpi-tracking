package com.kpitracking.service.task;

import com.kpitracking.dto.response.task.TaskActivityResponse;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.KpiTaskEvent;
import com.kpitracking.entity.user.User;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.task.KpiTaskEventRepository;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Trang "Hoạt động" kiểu Lark: dòng thời gian thay đổi của mọi việc mình tạo / phụ trách / theo dõi, hoặc của một danh sách
 * việc (tab "Hoạt động" của danh sách). Mỗi dòng đi qua đúng luật xem việc {@link KpiTaskAccess} — việc trong danh sách mà
 * mình không xem được (vd. gắn KPI mình không xem) bị bỏ, nên một trang có thể ít hơn {@code size} dòng.
 */
@Service
@RequiredArgsConstructor
public class TaskActivityService {

    static final int MAX_SIZE = 100;

    private final KpiTaskService taskService;
    private final KpiTaskAccess access;
    private final TaskListAccess listAccess;
    private final KpiTaskEventRepository eventRepository;
    private final KpiTaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public TaskActivityResponse feed(UUID listId, int page, int size) {
        User me = taskService.currentUser();
        int limit = Math.min(Math.max(size, 1), MAX_SIZE);
        int offset = Math.max(page, 0) * limit;
        List<KpiTaskEvent> events;
        if (listId != null) {
            if (listAccess.roleOf(me.getId(), listId) == null) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_VIEW);
            events = eventRepository.listFeed(listId, limit + 1, offset);
        } else {
            UUID org = taskService.organizationOf(me);
            if (org == null) return TaskActivityResponse.builder().items(List.of()).hasMore(false).build();
            events = eventRepository.myFeed(org, me.getId(), limit + 1, offset);
        }
        boolean hasMore = events.size() > limit;
        if (hasMore) events = events.subList(0, limit);

        Map<UUID, KpiTask> tasks = taskRepository.findAllById(events.stream().map(KpiTaskEvent::getTaskId).collect(Collectors.toSet()))
                .stream().filter(t -> access.canView(me.getId(), t)).collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        Set<UUID> userIds = new HashSet<>();
        events.forEach(e -> {
            if (e.getActorId() != null) userIds.add(e.getActorId());
            KpiTaskService.addIfUuid(userIds, e.getOldValue());
            KpiTaskService.addIfUuid(userIds, e.getNewValue());
        });
        Map<UUID, User> users = userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, String> names = users.values().stream().collect(Collectors.toMap(User::getId, User::getFullName));
        List<TaskActivityResponse.Item> items = events.stream().filter(e -> tasks.containsKey(e.getTaskId())).map(e -> {
            User actor = e.getActorId() == null ? null : users.get(e.getActorId());
            return TaskActivityResponse.Item.builder()
                    .id(e.getId()).taskId(e.getTaskId()).taskTitle(tasks.get(e.getTaskId()).getTitle()).action(e.getAction())
                    .oldValue(KpiTaskService.nameOr(names, e.getOldValue())).newValue(KpiTaskService.nameOr(names, e.getNewValue()))
                    .actorId(e.getActorId()).actorName(actor == null ? null : actor.getFullName())
                    .actorAvatarUrl(actor == null ? null : actor.getAvatarUrl()).createdAt(e.getCreatedAt())
                    .build();
        }).toList();
        return TaskActivityResponse.builder().items(items).hasMore(hasMore).build();
    }
}
