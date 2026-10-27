package com.kpitracking.controller.task;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.service.task.TaskTagService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Nhãn công việc của tổ chức. */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Task tags", description = "Nhãn công việc")
public class TaskTagController {

    private final TaskTagService tagService;

    @GetMapping("/task-tags")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<TaskListResponses.Tag>>> list() {
        return ResponseEntity.ok(ApiResponse.success(tagService.list()));
    }

    @PostMapping("/task-tags")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.Tag>> create(@Valid @RequestBody TaskListRequests.Tag request) {
        return ResponseEntity.ok(ApiResponse.success(tagService.create(request)));
    }

    @PatchMapping("/task-tags/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.Tag>> update(@PathVariable UUID id, @Valid @RequestBody TaskListRequests.Tag request) {
        return ResponseEntity.ok(ApiResponse.success(tagService.update(id, request)));
    }

    @DeleteMapping("/task-tags/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        tagService.delete(id);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }
}
