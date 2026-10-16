package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.TaskTagLink;
import com.kpitracking.entity.User;
import com.kpitracking.enums.KpiTaskEventAction;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.event.TaskEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.CodedException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.repository.TaskTagLinkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.*;

/**
 * Thao tác hàng loạt trên nhiều việc (chọn nhiều ở danh sách). Mỗi việc chạy trong MỘT transaction riêng qua đúng các
 * hàm đơn lẻ — nên mọi luật (quyền, khoá kỳ, KPI, kiểu hoàn thành…) vẫn áp; việc nào hỏng không kéo việc khác. Trả kết
 * quả từng dòng (mã lỗi + câu đã dịch). Hàng loạt KHÔNG kiểm {@code version} (luôn áp lên bản mới nhất).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TaskBatchService {

    public static final int MAX = 200;
    private static final Set<String> ACTIONS = Set.of("COMPLETE", "REOPEN", "SET_STATUS", "SET_PRIORITY", "SET_DUE", "SHIFT_DUE",
            "SET_START", "ADD_ASSIGNEE", "ADD_TO_LIST", "REMOVE_FROM_LIST", "MOVE_SECTION", "ADD_TAG", "REMOVE_TAG", "ADD_FOLLOWER", "DELETE");

    private final KpiTaskService taskService;
    private final TaskListService listService;
    private final KpiTaskAccess access;
    private final TaskTagLinkRepository tagLinkRepository;
    private final PlatformTransactionManager txManager;
    private final ApplicationEventPublisher events;

    public TaskListResponses.BatchResult run(TaskListRequests.Batch req) {
        String action = req.getAction() == null ? "" : req.getAction().toUpperCase(Locale.ROOT);
        if (!ACTIONS.contains(action)) throw new BusinessException(ErrorCode.TASK_BATCH_ACTION_INVALID);
        List<UUID> ids = new ArrayList<>(new LinkedHashSet<>(req.getTaskIds()));
        if (ids.isEmpty() || ids.size() > MAX) throw new BusinessException(ErrorCode.TASK_BATCH_TOO_LARGE, MAX);
        validate(action, req);
        TransactionTemplate tx = new TransactionTemplate(txManager);
        User me = tx.execute(s -> taskService.currentUser());
        List<TaskListResponses.BatchRow> rows = new ArrayList<>();
        int ok = 0;
        for (UUID id : ids) {
            try {
                tx.executeWithoutResult(s -> apply(me, id, action, req));
                rows.add(TaskListResponses.BatchRow.builder().taskId(id).ok(true).build());
                ok++;
            } catch (Exception e) {
                String code = e instanceof CodedException c && c.getErrorCode() != null ? c.getErrorCode().name() : "BUSINESS_RULE";
                rows.add(TaskListResponses.BatchRow.builder().taskId(id).ok(false).code(code).message(e.getMessage()).build());
                if (!(e instanceof CodedException)) log.warn("Thao tác hàng loạt {} lỗi ở việc {}", action, id, e);
            }
        }
        return TaskListResponses.BatchResult.builder().total(ids.size()).succeeded(ok).results(rows).build();
    }

    private static void validate(String action, TaskListRequests.Batch req) {
        boolean ok = switch (action) {
            case "SET_STATUS" -> req.getStatus() != null;
            case "SET_PRIORITY" -> req.getPriority() != null;
            case "SET_DUE", "SET_START" -> req.getDate() != null || req.isClear();
            case "SHIFT_DUE" -> req.getDays() != null && Math.abs(req.getDays()) <= 3650;
            case "ADD_ASSIGNEE", "ADD_FOLLOWER" -> req.getUserId() != null;
            case "ADD_TO_LIST", "REMOVE_FROM_LIST", "MOVE_SECTION" -> req.getListId() != null;
            case "ADD_TAG", "REMOVE_TAG" -> req.getTagId() != null;
            default -> true;
        };
        if (!ok) throw new BusinessException(ErrorCode.TASK_BATCH_ACTION_INVALID);
    }

    private void apply(User me, UUID id, String action, TaskListRequests.Batch req) {
        switch (action) {
            case "COMPLETE" -> taskService.applyStatus(me, taskService.editable(me, id, null, false), KpiTaskStatus.DONE, null, req.isForce());
            case "REOPEN" -> taskService.applyStatus(me, taskService.editable(me, id, null, false), KpiTaskStatus.TODO, null, false);
            case "SET_STATUS" -> taskService.applyStatus(me, taskService.editable(me, id, null, false), req.getStatus(), null, req.isForce());
            case "SET_PRIORITY" -> taskService.setPriorityInternal(me, taskService.editable(me, id, null, false), req.getPriority());
            case "SET_DUE" -> taskService.setDueInternal(me, taskService.editable(me, id, null, false), req.isClear() ? null : req.getDate());
            case "SET_START" -> taskService.setStartInternal(me, taskService.editable(me, id, null, false), req.isClear() ? null : req.getDate());
            case "SHIFT_DUE" -> {
                KpiTask t = taskService.editable(me, id, null, false);
                // Dời cả khoảng: bắt đầu trước để không vướng "bắt đầu sau hạn".
                LocalDate start = t.getStartDate() != null ? t.getStartDate().plusDays(req.getDays()) : null;
                LocalDate due = t.getDueDate() != null ? t.getDueDate().plusDays(req.getDays()) : null;
                if (req.getDays() > 0) {
                    if (due != null) taskService.setDueInternal(me, t, due);
                    if (start != null) taskService.setStartInternal(me, t, start);
                } else {
                    if (start != null) taskService.setStartInternal(me, t, start);
                    if (due != null) taskService.setDueInternal(me, t, due);
                }
            }
            case "ADD_ASSIGNEE" -> {
                KpiTask t = taskService.findTask(id);
                if (!access.canReassign(me.getId(), t)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_EDIT);
                taskService.addAssigneeInternal(me, t, req.getUserId());
            }
            case "ADD_FOLLOWER" -> taskService.addFollowerInternal(me, taskService.editable(me, id, null, false), req.getUserId());
            case "ADD_TO_LIST" -> listService.addItem(req.getListId(),
                    TaskListRequests.Item.builder().taskId(id).sectionId(req.getSectionId()).build());
            case "REMOVE_FROM_LIST" -> listService.removeItem(req.getListId(), id);
            case "MOVE_SECTION" -> listService.moveItem(req.getListId(), TaskListRequests.Item.builder().taskId(id)
                    .sectionId(req.getSectionId()).clearSection(req.getSectionId() == null).build());
            case "ADD_TAG", "REMOVE_TAG" -> {
                KpiTask t = taskService.editable(me, id, null, false);
                Set<UUID> tags = new LinkedHashSet<>(tagLinkRepository.findByTaskId(id).stream().map(TaskTagLink::getTagId).toList());
                boolean changed = "ADD_TAG".equals(action) ? tags.add(req.getTagId()) : tags.remove(req.getTagId());
                if (!changed) return;
                taskService.setTagsInternal(t, tags);
                taskService.log(t, me, KpiTaskEventAction.TAGS_CHANGED, null, String.valueOf(tags.size()));
                events.publishEvent(TaskEvents.Changed.of(id, me.getId(), TaskEvents.Kind.TAGS_CHANGED));
            }
            case "DELETE" -> taskService.deleteInternal(me, id);
            default -> throw new BusinessException(ErrorCode.TASK_BATCH_ACTION_INVALID);
        }
    }
}
