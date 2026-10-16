package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.entity.TaskTag;
import com.kpitracking.entity.User;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.TaskListMapper;
import com.kpitracking.repository.TaskTagRepository;
import com.kpitracking.security.PermissionChecker;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Nhãn công việc dùng chung trong tổ chức. Ai có trang Công việc cũng tạo / gắn được; sửa / xoá nhãn: người tạo nhãn hoặc
 * quản trị tổ chức (xoá nhãn gỡ nó khỏi mọi việc).
 */
@Service
@RequiredArgsConstructor
public class TaskTagService {

    public static final int MAX_TAGS = 500;

    private final TaskTagRepository tagRepository;
    private final KpiTaskService taskService;
    private final PermissionChecker permissionChecker;
    private final TaskListMapper mapper;

    @Transactional(readOnly = true)
    public List<TaskListResponses.Tag> list() {
        User me = taskService.currentUser();
        UUID orgId = taskService.organizationOf(me);
        if (orgId == null) return List.of();
        return tagRepository.findByOrganizationIdOrderByNameAsc(orgId).stream().map(mapper::toTag).toList();
    }

    /** Tạo nhãn; trùng tên (không phân biệt hoa thường) thì trả nhãn có sẵn. */
    @Transactional
    public TaskListResponses.Tag create(TaskListRequests.Tag req) {
        User me = taskService.currentUser();
        taskService.requireOwnPermission(me);
        UUID orgId = taskService.organizationOf(me);
        String name = requireName(req.getName());
        TaskTag existing = tagRepository.findByName(orgId, name).orElse(null);
        if (existing != null) return mapper.toTag(existing);
        if (tagRepository.findByOrganizationIdOrderByNameAsc(orgId).size() >= MAX_TAGS) {
            throw new BusinessException(ErrorCode.TASK_TAG_NAME_REQUIRED);
        }
        return mapper.toTag(tagRepository.save(TaskTag.builder().organizationId(orgId).name(name).color(req.getColor())
                .createdBy(me.getId()).build()));
    }

    @Transactional
    public TaskListResponses.Tag update(UUID tagId, TaskListRequests.Tag req) {
        User me = taskService.currentUser();
        TaskTag tag = editable(me, tagId);
        if (req.getName() != null) {
            String name = requireName(req.getName());
            tagRepository.findByName(tag.getOrganizationId(), name).filter(t -> !t.getId().equals(tagId)).ifPresent(t -> {
                throw new BusinessException(ErrorCode.TASK_TAG_NAME_REQUIRED);
            });
            tag.setName(name);
        }
        if (req.getColor() != null) tag.setColor(req.getColor().isBlank() ? null : req.getColor());
        return mapper.toTag(tagRepository.save(tag));
    }

    @Transactional
    public void delete(UUID tagId) {
        User me = taskService.currentUser();
        tagRepository.delete(editable(me, tagId));
    }

    private TaskTag editable(User me, UUID tagId) {
        UUID orgId = taskService.organizationOf(me);
        TaskTag tag = tagRepository.findById(tagId).filter(t -> t.getOrganizationId().equals(orgId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_TAG_NOT_FOUND));
        boolean admin = permissionChecker.isGlobalAdminOfOrganization(me.getId(), orgId);
        if (!admin && !me.getId().equals(tag.getCreatedBy())) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_EDIT);
        return tag;
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) throw new BusinessException(ErrorCode.TASK_TAG_NAME_REQUIRED);
        return KpiTaskService.truncate(name.strip(), 60);
    }
}
