package com.kpitracking.service.task;

import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiTaskEventAction;
import com.kpitracking.event.TaskEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.KpiTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Các thao tác "cấu trúc" trong menu ··· của bảng chi tiết, đúng như Lark: Đặt việc cha (Set Parent Task), Chuyển thành việc
 * độc lập (Convert to Task) và Đánh dấu mốc (Mark as Milestone).
 *
 * Đổi việc cha giữ các luật của cây việc: chỉ người SỬA được cả việc lẫn việc cha mới (khoá kỳ đi qua {@code editable});
 * không vòng (việc cha mới không được là chính nó hay con cháu của nó); cả cây sau khi chuyển không sâu quá
 * {@link KpiTaskService#MAX_DEPTH}; việc con luôn cùng KPI và cùng phạm vi xem với việc cha — khác thì báo lỗi, không tự đổi
 * KPI (đổi KPI phải đi qua {@code setKpi} với hộp xác nhận người theo dõi). Đường dẫn tổ tiên của mọi con cháu được viết lại.
 */
@Service
@RequiredArgsConstructor
public class TaskStructureService {

    private final KpiTaskService taskService;
    private final KpiTaskRepository taskRepository;
    private final TaskResponseAssembler assembler;
    private final ApplicationEventPublisher events;

    @Transactional
    public KpiTaskResponse changeParent(UUID taskId, UUID parentId, Long version) {
        User me = taskService.currentUser();
        KpiTask task = taskService.editable(me, taskId, version, false);
        if (Objects.equals(task.getParentTaskId(), parentId)) return assembler.detail(me, task);
        KpiTask parent = null;
        if (parentId != null) {
            if (parentId.equals(taskId)) throw new BusinessException(ErrorCode.TASK_PARENT_INVALID);
            parent = taskService.editable(me, parentId, null, false);
            if (Arrays.asList(nz(parent.getAncestorIds())).contains(taskId)
                    || !Objects.equals(parent.getOrganizationId(), task.getOrganizationId())) {
                throw new BusinessException(ErrorCode.TASK_PARENT_INVALID);
            }
            if (!Objects.equals(parent.getKpiCriteriaId(), task.getKpiCriteriaId())) throw new BusinessException(ErrorCode.TASK_PARENT_KPI_MISMATCH);
            if (parent.getVisibility() != task.getVisibility()) throw new BusinessException(ErrorCode.TASK_PARENT_VISIBILITY_MISMATCH);
        }
        List<KpiTask> descendants = taskRepository.findDescendants(taskId);
        int oldLen = nz(task.getAncestorIds()).length;
        int height = descendants.stream().mapToInt(d -> nz(d.getAncestorIds()).length - oldLen).max().orElse(0);
        UUID[] newAncestors = parent == null ? new UUID[0] : KpiTaskService.append(parent.getAncestorIds(), parent.getId());
        if (newAncestors.length + height > KpiTaskService.MAX_DEPTH) {
            throw new BusinessException(ErrorCode.TASK_SUBTASK_TOO_DEEP, KpiTaskService.MAX_DEPTH + 1);
        }
        String oldParentTitle = task.getParentTaskId() == null ? null
                : taskRepository.findById(task.getParentTaskId()).map(KpiTask::getTitle).orElse(null);
        UUID root = newAncestors.length > 0 ? newAncestors[0] : task.getId();

        task.setParentTaskId(parentId);
        task.setRootTaskId(parent == null ? null : root);
        task.setAncestorIds(newAncestors);
        task.setDepth((short) newAncestors.length);
        for (KpiTask d : descendants) {
            UUID[] old = nz(d.getAncestorIds());
            UUID[] tail = Arrays.copyOfRange(old, oldLen, old.length); // bắt đầu bằng id của việc đang chuyển
            UUID[] next = Arrays.copyOf(newAncestors, newAncestors.length + tail.length);
            System.arraycopy(tail, 0, next, newAncestors.length, tail.length);
            d.setAncestorIds(next);
            d.setDepth((short) next.length);
            d.setRootTaskId(root);
        }
        taskRepository.saveAll(descendants);
        taskRepository.save(task);
        taskService.log(task, me, KpiTaskEventAction.PARENT_CHANGED, oldParentTitle, parent == null ? null : parent.getTitle());
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        if (parent != null) events.publishEvent(TaskEvents.Changed.of(parent.getId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        return assembler.detail(me, task);
    }

    @Transactional
    public KpiTaskResponse setMilestone(UUID taskId, boolean milestone, Long version) {
        User me = taskService.currentUser();
        KpiTask task = taskService.editable(me, taskId, version, false);
        if (task.isMilestone() != milestone) {
            task.setMilestone(milestone);
            taskRepository.save(task);
            taskService.log(task, me, KpiTaskEventAction.MILESTONE_CHANGED, String.valueOf(!milestone), String.valueOf(milestone));
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.UPDATED));
        }
        return assembler.detail(me, task);
    }

    private static UUID[] nz(UUID[] a) {
        return a == null ? new UUID[0] : a;
    }
}
