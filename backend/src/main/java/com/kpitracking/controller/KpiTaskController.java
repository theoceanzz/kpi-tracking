package com.kpitracking.controller;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.task.*;
import com.kpitracking.enums.KpiTaskAttachmentKind;
import com.kpitracking.enums.KpiTaskPriority;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.service.task.KpiTaskService;
import com.kpitracking.service.task.TaskSearch;
import com.kpitracking.service.task.TaskBatchService;
import com.kpitracking.service.task.TaskExcelService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Công việc gắn KPI (kiểu Lark Tasks). Quyền xem / sửa / giao kiểm theo từng task trong service ({@code KpiTaskAccess}),
 * nên ở đây chỉ đòi đăng nhập.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "KPI Tasks", description = "Công việc gắn với KPI")
public class KpiTaskController {

    private final KpiTaskService taskService;
    private final TaskBatchService batchService;
    private final TaskExcelService excelService;

    @GetMapping({"/kpi-tasks", "/kpi-tasks/my"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Danh sách theo chế độ xem (ASSIGNED|FOLLOWING|CREATED|DELEGATED|ALL|DONE|TEAM|LIST|SEARCH) + bộ lọc; "
            + "due = OVERDUE|TODAY|TOMORROW|WEEK|LATER|NONE; dueFrom/dueTo cho Lịch; rangeFrom/rangeTo cho Gantt; "
            + "fieldFilters = JSON [{fieldId, op, value}] (chỉ trong một danh sách)")
    public ResponseEntity<ApiResponse<PageResponse<KpiTaskResponse>>> list(
            @RequestParam(required = false) String view,
            @RequestParam(required = false) UUID kpiId,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(required = false) List<KpiTaskStatus> status,
            @RequestParam(required = false) KpiTaskPriority priority,
            @RequestParam(required = false) String due,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dueTo,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "false") boolean topLevel,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size,
            @RequestParam(required = false) UUID listId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(defaultValue = "false") boolean noSection,
            @RequestParam(required = false) Boolean hasKpi,
            @RequestParam(required = false) List<UUID> tagIds,
            @RequestParam(required = false) String fieldFilters,
            @RequestParam(required = false) UUID sortFieldId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate rangeFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate rangeTo) {
        return ResponseEntity.ok(ApiResponse.success(taskService.list(new KpiTaskService.ListQuery(
                view, kpiId, kpiPeriodId, ownerId, status, priority, due, dueFrom, dueTo, keyword, sort, topLevel, page, size,
                listId, sectionId, noSection, hasKpi, tagIds, parseFieldFilters(fieldFilters), sortFieldId, rangeFrom, rangeTo))));
    }

    @GetMapping("/kpi-tasks/export")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xuất Excel theo đúng bộ lọc đang xem (chỉ việc người gọi xem được)")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String view,
            @RequestParam(required = false) UUID kpiId,
            @RequestParam(required = false) UUID kpiPeriodId,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(required = false) List<KpiTaskStatus> status,
            @RequestParam(required = false) KpiTaskPriority priority,
            @RequestParam(required = false) String due,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) UUID listId,
            @RequestParam(required = false) UUID sectionId,
            @RequestParam(required = false) Boolean hasKpi,
            @RequestParam(required = false) List<UUID> tagIds,
            @RequestParam(required = false) String fieldFilters) throws java.io.IOException {
        byte[] bytes = excelService.export(new KpiTaskService.ListQuery(view, kpiId, kpiPeriodId, ownerId, status, priority, due,
                null, null, keyword, sort, false, 0, 500, listId, sectionId, false, hasKpi, tagIds, parseFieldFilters(fieldFilters),
                null, null, null));
        return TaskListController.file(bytes, "tasks.xlsx");
    }

    @PostMapping("/kpi-tasks/batch")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thao tác hàng loạt (tối đa 200 việc) — kết quả từng dòng")
    public ResponseEntity<ApiResponse<TaskListResponses.BatchResult>> batch(@Valid @RequestBody TaskListRequests.Batch request) {
        return ResponseEntity.ok(ApiResponse.success(batchService.run(request)));
    }

    /** Mảng JSON các {fieldId, op, value} — sai định dạng thì bỏ qua bộ lọc. */
    private static List<TaskSearch.FieldFilter> parseFieldFilters(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Map<String, Object>> raw = new com.fasterxml.jackson.databind.ObjectMapper().readValue(json,
                    new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {});
            return raw.stream().filter(m -> m.get("fieldId") != null && m.get("op") != null)
                    .map(m -> new TaskSearch.FieldFilter(UUID.fromString(m.get("fieldId").toString()), null,
                            m.get("op").toString(), m.get("value")))
                    .limit(10).toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    @GetMapping("/kpi-tasks/sidebar")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Số việc chưa xong cho cột trái + huy hiệu menu")
    public ResponseEntity<ApiResponse<TaskSidebarResponse>> sidebar() {
        return ResponseEntity.ok(ApiResponse.success(taskService.sidebar()));
    }

    @GetMapping("/kpi-tasks/badge")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Long>>> badge() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("count", taskService.badge())));
    }

    @GetMapping("/kpi-tasks/assignable-users")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Người tôi được giao việc: all=false ⇒ trên KPI (chính tôi + đơn vị tôi quản lý nếu có TASK:ASSIGN); "
            + "all=true ⇒ việc không KPI (mọi người trong tổ chức)")
    public ResponseEntity<ApiResponse<List<TaskOptionResponse>>> assignableUsers(@RequestParam(required = false) String q,
                                                                                @RequestParam(defaultValue = "false") boolean all) {
        return ResponseEntity.ok(ApiResponse.success(taskService.assignableUsers(q, all)));
    }

    @GetMapping("/kpi-tasks/assignable-kpis")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "KPI còn nhận việc của người được giao mà tôi được giao việc trên")
    public ResponseEntity<ApiResponse<List<TaskOptionResponse>>> assignableKpis(@RequestParam(required = false) UUID ownerId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.assignableKpis(ownerId)));
    }

    @GetMapping("/kpi-criteria/{kpiId}/tasks")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Việc (cấp cao nhất) trên một KPI mà người gọi thấy được")
    public ResponseEntity<ApiResponse<List<KpiTaskResponse>>> ofKpi(@PathVariable UUID kpiId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.tasksOfKpi(kpiId)));
    }

    @GetMapping("/kpi-criteria/{kpiId}/task-replacements")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "KPI cũ đã được thay bằng KPI này mà người gọi còn việc chưa xong")
    public ResponseEntity<ApiResponse<List<TaskReplacementResponse>>> replacements(@PathVariable UUID kpiId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.replacementCandidates(kpiId)));
    }

    @GetMapping("/kpi-tasks/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(taskService.get(id)));
    }

    @GetMapping("/kpi-tasks/{id}/events")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<KpiTaskEventResponse>>> history(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(taskService.history(id)));
    }

    @GetMapping("/kpi-tasks/{id}/follower-candidates")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gợi ý người theo dõi: chỉ người xem được KPI của task")
    public ResponseEntity<ApiResponse<List<TaskOptionResponse>>> followerCandidates(@PathVariable UUID id,
                                                                                    @RequestParam(required = false) String q) {
        return ResponseEntity.ok(ApiResponse.success(taskService.followerCandidates(id, q)));
    }

    @PostMapping("/kpi-tasks")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Tạo việc (parentTaskId ⇒ việc con; ownerId ⇒ giao cho người khác)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> create(@RequestBody CreateKpiTaskRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.create(request)));
    }

    @PostMapping("/kpi-tasks/{id}/subtasks")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> createSubtask(@PathVariable UUID id,
                                                                      @RequestBody CreateKpiTaskRequest request) {
        request.setParentTaskId(id);
        return ResponseEntity.ok(ApiResponse.success(taskService.create(request)));
    }

    @PatchMapping("/kpi-tasks/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Sửa từng trường (tự lưu), kèm version; việc lặp: scope = THIS | FOLLOWING")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> update(@PathVariable UUID id,
                                                               @Valid @RequestBody UpdateKpiTaskRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.update(id, request)));
    }

    @PatchMapping("/kpi-tasks/{id}/status")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Đổi trạng thái / vị trí; còn việc con chưa xong ⇒ 409 trừ khi force = true")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> changeStatus(@PathVariable UUID id,
                                                                     @Valid @RequestBody ChangeKpiTaskStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.changeStatus(id, request)));
    }

    @PostMapping("/kpi-tasks/{id}/assign")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Giao / giao lại (kpiId = KPI của người được giao)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> assign(@PathVariable UUID id,
                                                               @Valid @RequestBody AssignKpiTaskRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.assign(id, request)));
    }

    @PutMapping("/kpi-tasks/{id}/assignees")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thay danh sách người thực hiện (người đầu / primaryId là người chính)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setAssignees(@PathVariable UUID id,
                                                                     @Valid @RequestBody SetTaskAssigneesRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.setAssignees(id, request)));
    }

    @PutMapping("/kpi-tasks/{id}/kpi")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gắn / đổi / gỡ KPI của việc gốc (kpiId null = gỡ); xem trước người theo dõi bị gỡ qua assign-impact")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setKpi(@PathVariable UUID id, @Valid @RequestBody SetTaskKpiRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.setKpi(id, request)));
    }

    @PostMapping("/kpi-tasks/{id}/decline")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Từ chối việc được giao (chỉ việc không KPI)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> decline(@PathVariable UUID id, @Valid @RequestBody DeclineTaskRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.decline(id, request)));
    }

    @PutMapping("/kpi-tasks/{id}/tags")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thay bộ nhãn của việc")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setTags(@PathVariable UUID id, @RequestBody List<UUID> tagIds) {
        return ResponseEntity.ok(ApiResponse.success(taskService.setTags(id, tagIds)));
    }

    @PostMapping("/kpi-tasks/{id}/dependencies/{predecessorId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Việc {id} chờ việc {predecessorId} xong (FS)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> addDependency(@PathVariable UUID id, @PathVariable UUID predecessorId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.addDependency(id, predecessorId)));
    }

    @DeleteMapping("/kpi-task-dependencies/{dependencyId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> removeDependency(@PathVariable UUID dependencyId) {
        taskService.removeDependency(dependencyId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    @GetMapping("/kpi-tasks/{id}/assign-impact")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xem trước khi giao / chuyển KPI: người theo dõi nào sẽ bị gỡ khỏi việc nào (không xem được KPI mới)")
    public ResponseEntity<ApiResponse<List<TaskFollowerRemovalResponse>>> assignImpact(@PathVariable UUID id,
                                                                                       @RequestParam(required = false) UUID kpiId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.assignImpact(id, kpiId)));
    }

    @PutMapping("/kpi-tasks/{id}/followers/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> addFollower(@PathVariable UUID id, @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.addFollower(id, userId)));
    }

    @DeleteMapping("/kpi-tasks/{id}/followers/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> removeFollower(@PathVariable UUID id, @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.removeFollower(id, userId)));
    }

    @PutMapping("/kpi-tasks/{id}/reminders")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thay toàn bộ mốc nhắc của task (tối đa 5)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setReminders(@PathVariable UUID id,
                                                                     @RequestBody List<KpiTaskReminderInput> reminders) {
        return ResponseEntity.ok(ApiResponse.success(taskService.setReminders(id, reminders)));
    }

    @PostMapping("/kpi-tasks/{id}/duplicate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> duplicate(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(taskService.duplicate(id)));
    }

    @DeleteMapping("/kpi-tasks/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        taskService.delete(id);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    @PostMapping("/kpi-tasks/{id}/checklist")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> addChecklist(@PathVariable UUID id,
                                                                     @RequestBody KpiTaskChecklistRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.addChecklistItem(id, request)));
    }

    @PatchMapping("/kpi-tasks/{id}/checklist/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> updateChecklist(@PathVariable UUID id, @PathVariable UUID itemId,
                                                                        @RequestBody KpiTaskChecklistRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taskService.updateChecklistItem(id, itemId, request)));
    }

    @DeleteMapping("/kpi-tasks/{id}/checklist/{itemId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> deleteChecklist(@PathVariable UUID id, @PathVariable UUID itemId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.deleteChecklistItem(id, itemId)));
    }

    @PostMapping(value = "/kpi-tasks/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> addAttachments(@PathVariable UUID id,
                                                                       @RequestParam("files") MultipartFile[] files,
                                                                       @RequestParam(required = false) List<String> sourceDocumentIds,
                                                                       @RequestParam(defaultValue = "REFERENCE") KpiTaskAttachmentKind kind) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(taskService.addAttachments(id, files, sourceDocumentIds, kind)));
    }

    @DeleteMapping("/kpi-tasks/{id}/attachments/{attachmentId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> deleteAttachment(@PathVariable UUID id, @PathVariable UUID attachmentId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.deleteAttachment(id, attachmentId)));
    }

    @PostMapping("/kpi-tasks/move")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chuyển việc của người gọi sang KPI khác (vd. KPI cũ đã được thay)")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> move(@Valid @RequestBody MoveKpiTasksRequest request) {
        return ResponseEntity.ok(ApiResponse.success(Map.of("moved", taskService.move(request))));
    }

    @GetMapping("/kpi-tasks/move-impact")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xem trước khi chuyển việc sang KPI khác: người theo dõi nào sẽ bị gỡ khỏi việc nào")
    public ResponseEntity<ApiResponse<List<TaskFollowerRemovalResponse>>> moveImpact(@RequestParam UUID fromKpiId,
                                                                                     @RequestParam UUID toKpiId,
                                                                                     @RequestParam(required = false) List<UUID> taskIds) {
        return ResponseEntity.ok(ApiResponse.success(taskService.moveImpact(fromKpiId, toKpiId, taskIds)));
    }
}
