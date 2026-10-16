package com.kpitracking.controller;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.request.task.TaskStructureRequests;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.dto.response.task.TaskActivityResponse;
import com.kpitracking.service.task.TaskActivityService;
import com.kpitracking.service.task.TaskListService;
import com.kpitracking.service.task.TaskMySectionService;
import com.kpitracking.service.task.TaskPresenceService;
import com.kpitracking.service.task.TaskStructureService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Cá nhân hoá Công việc (V42 §5): nhóm riêng trong "Việc của tôi", ghim / thư mục danh sách, bảng điều khiển danh sách;
 * và "ai đang xem việc này" (nhịp hiện diện, chỉ trong bộ nhớ).
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Task personal", description = "Nhóm riêng, ghim / thư mục danh sách, bảng điều khiển")
public class TaskPersonalController {

    private final TaskMySectionService mySectionService;
    private final TaskListService listService;
    private final TaskPresenceService presenceService;
    private final TaskActivityService activityService;
    private final TaskStructureService structureService;

    @GetMapping("/kpi-tasks/my-sections")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<TaskListResponses.MySection>>> mySections() {
        return ResponseEntity.ok(ApiResponse.success(mySectionService.list()));
    }

    @PostMapping("/kpi-tasks/my-sections")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.MySection>> createMySection(@Valid @RequestBody TaskListRequests.MySection request) {
        return ResponseEntity.ok(ApiResponse.success(mySectionService.create(request)));
    }

    @PatchMapping("/kpi-tasks/my-sections/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.MySection>> updateMySection(@PathVariable UUID id,
                                                                                   @Valid @RequestBody TaskListRequests.MySection request) {
        return ResponseEntity.ok(ApiResponse.success(mySectionService.update(id, request)));
    }

    @DeleteMapping("/kpi-tasks/my-sections/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteMySection(@PathVariable UUID id) {
        mySectionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/kpi-tasks/{id}/my-section")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xếp việc vào nhóm riêng của tôi (sectionId null = bỏ khỏi nhóm)")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> assignMySection(@PathVariable UUID id,
                                                                       @RequestBody TaskListRequests.MySectionAssign request) {
        return ResponseEntity.ok(ApiResponse.success(mySectionService.assign(id, request)));
    }

    @PutMapping("/task-lists/{id}/my-prefs")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Ghim / thư mục của riêng tôi cho một danh sách")
    public ResponseEntity<ApiResponse<Void>> setMyPrefs(@PathVariable UUID id, @Valid @RequestBody TaskListRequests.MyPrefs request) {
        listService.setMyPrefs(id, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/task-lists/{id}/dashboard")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lưu cấu hình bảng điều khiển của danh sách (biên tập trở lên)")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> setDashboard(@PathVariable UUID id,
                                                                                     @RequestBody TaskListRequests.Dashboard request) {
        return ResponseEntity.ok(ApiResponse.success(listService.setDashboard(id, request)));
    }

    /** Lark: ··· > Đặt việc cha / Chuyển thành việc độc lập ({@code parentTaskId} null). */
    @PutMapping("/kpi-tasks/{id}/parent")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setParent(@PathVariable UUID id, @RequestBody TaskStructureRequests.Parent request) {
        return ResponseEntity.ok(ApiResponse.success(structureService.changeParent(id, request.getParentTaskId(), request.getVersion())));
    }

    /** Lark: ··· > Đánh dấu mốc. */
    @PutMapping("/kpi-tasks/{id}/milestone")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setMilestone(@PathVariable UUID id, @RequestBody TaskStructureRequests.Milestone request) {
        return ResponseEntity.ok(ApiResponse.success(structureService.setMilestone(id, request.isMilestone(), request.getVersion())));
    }

    @GetMapping("/kpi-tasks/activities")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Hoạt động (kiểu Lark): thay đổi của việc mình tạo / phụ trách / theo dõi, hoặc của một danh sách (listId)")
    public ResponseEntity<ApiResponse<TaskActivityResponse>> activities(@RequestParam(required = false) UUID listId,
                                                                        @RequestParam(defaultValue = "0") int page,
                                                                        @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(activityService.feed(listId, page, size)));
    }

    @PostMapping("/kpi-tasks/{id}/presence")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Nhịp \"đang xem việc này\" (~20s/lần); trả những người khác đang xem")
    public ResponseEntity<ApiResponse<List<TaskPresenceService.Viewer>>> presence(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(presenceService.beat(id)));
    }

    @DeleteMapping("/kpi-tasks/{id}/presence")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> leavePresence(@PathVariable UUID id) {
        presenceService.leave(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
