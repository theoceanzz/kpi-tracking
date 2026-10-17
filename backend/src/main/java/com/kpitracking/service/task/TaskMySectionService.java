package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.TaskMySection;
import com.kpitracking.entity.TaskMySectionItem;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.TaskMySectionItemRepository;
import com.kpitracking.repository.TaskMySectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Nhóm riêng trong "Việc của tôi" (như "My tasks" của Lark): mỗi người tự chia việc mình xem được thành các nhóm (Hôm nay,
 * Tuần này…). Chỉ là cách sắp xếp của RIÊNG người đó — không đổi dữ liệu của việc, không ai khác thấy; xoá nhóm thì việc
 * trong nhóm về "Chưa xếp nhóm".
 */
@Service
@RequiredArgsConstructor
public class TaskMySectionService {

    static final int MAX_SECTIONS = 30;

    private final TaskMySectionRepository sectionRepository;
    private final TaskMySectionItemRepository itemRepository;
    private final KpiTaskService taskService;
    private final KpiTaskAccess access;

    @Transactional(readOnly = true)
    public List<TaskListResponses.MySection> list() {
        User me = taskService.currentUser();
        return sectionRepository.findByUserIdOrderBySortOrderAscCreatedAtAsc(me.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional
    public TaskListResponses.MySection create(TaskListRequests.MySection req) {
        User me = taskService.currentUser();
        if (sectionRepository.countByUserId(me.getId()) >= MAX_SECTIONS) throw invalid();
        TaskMySection s = sectionRepository.save(TaskMySection.builder().userId(me.getId()).name(name(req.getName()))
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : sectionRepository.maxSortOrder(me.getId()) + 1).build());
        return toResponse(s);
    }

    @Transactional
    public TaskListResponses.MySection update(UUID id, TaskListRequests.MySection req) {
        TaskMySection s = own(id);
        if (req.getName() != null) s.setName(name(req.getName()));
        if (req.getSortOrder() != null) s.setSortOrder(req.getSortOrder());
        return toResponse(sectionRepository.save(s));
    }

    @Transactional
    public void delete(UUID id) {
        sectionRepository.delete(own(id));
    }

    /** Xếp một việc mình xem được vào nhóm riêng (null = bỏ khỏi nhóm). */
    @Transactional
    public KpiTaskResponse assign(UUID taskId, TaskListRequests.MySectionAssign req) {
        User me = taskService.currentUser();
        KpiTask task = taskService.findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        TaskMySectionItem.Key key = new TaskMySectionItem.Key(me.getId(), taskId);
        if (req.getSectionId() == null) {
            itemRepository.deleteById(key);
        } else {
            TaskMySection s = own(req.getSectionId());
            itemRepository.save(TaskMySectionItem.builder().userId(me.getId()).taskId(taskId).sectionId(s.getId()).build());
        }
        itemRepository.flush();
        return taskService.get(taskId);
    }

    private TaskMySection own(UUID id) {
        User me = taskService.currentUser();
        return sectionRepository.findById(id).filter(s -> s.getUserId().equals(me.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_MY_SECTION_NOT_FOUND));
    }

    private static String name(String raw) {
        String v = raw == null ? "" : raw.strip();
        if (v.isEmpty() || v.length() > 120) throw invalid();
        return v;
    }

    private static BusinessException invalid() {
        return new BusinessException(ErrorCode.TASK_MY_SECTION_INVALID, MAX_SECTIONS);
    }

    private TaskListResponses.MySection toResponse(TaskMySection s) {
        return TaskListResponses.MySection.builder().id(s.getId()).name(s.getName()).sortOrder(s.getSortOrder()).build();
    }
}
