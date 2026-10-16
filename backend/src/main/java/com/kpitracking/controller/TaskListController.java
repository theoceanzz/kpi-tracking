package com.kpitracking.controller;

import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.ApiResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.service.task.TaskExcelService;
import com.kpitracking.service.task.TaskListService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Danh sách công việc kiểu Lark (V42). Quyền kiểm theo vai trò trong danh sách ở service ({@code TaskListAccess}), nên ở
 * đây chỉ đòi đăng nhập.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Task lists", description = "Danh sách công việc, nhóm, trường tuỳ chỉnh, chế độ xem, mẫu, tự động hoá")
public class TaskListController {

    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final TaskListService listService;
    private final TaskExcelService excelService;

    // ── Danh sách ──

    @GetMapping("/task-lists/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(listService.get(id)));
    }

    @PostMapping("/task-lists")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Tạo danh sách (có thể từ mẫu: templateId hoặc builtinTemplate)")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> create(@Valid @RequestBody TaskListRequests.Upsert request) {
        return ResponseEntity.ok(ApiResponse.success(listService.create(request)));
    }

    @PatchMapping("/task-lists/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> update(@PathVariable UUID id,
                                                                               @Valid @RequestBody TaskListRequests.Upsert request) {
        return ResponseEntity.ok(ApiResponse.success(listService.update(id, request)));
    }

    @PostMapping("/task-lists/{id}/archive")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lưu trữ / khôi phục danh sách (archived=false)")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> archive(@PathVariable UUID id,
                                                                                @RequestParam(defaultValue = "true") boolean archived) {
        return ResponseEntity.ok(ApiResponse.success(listService.archive(id, archived)));
    }

    @DeleteMapping("/task-lists/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xoá danh sách (việc vẫn còn, chỉ gỡ khỏi danh sách)")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        listService.delete(id);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    // ── Thành viên ──

    @PostMapping("/task-lists/{id}/members")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> addMember(@PathVariable UUID id,
                                                                                  @Valid @RequestBody TaskListRequests.Member request) {
        return ResponseEntity.ok(ApiResponse.success(listService.addMember(id, request)));
    }

    @PatchMapping("/task-lists/{id}/members/{memberId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> updateMember(@PathVariable UUID id, @PathVariable UUID memberId,
                                                                                     @Valid @RequestBody TaskListRequests.Member request) {
        return ResponseEntity.ok(ApiResponse.success(listService.updateMember(id, memberId, request)));
    }

    @DeleteMapping("/task-lists/{id}/members/{memberId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Gỡ thành viên / tự rời danh sách")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> removeMember(@PathVariable UUID id, @PathVariable UUID memberId) {
        return ResponseEntity.ok(ApiResponse.success(listService.removeMember(id, memberId)));
    }

    // ── Nhóm ──

    @PostMapping("/task-lists/{id}/sections")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> addSection(@PathVariable UUID id,
                                                                                   @Valid @RequestBody TaskListRequests.Section request) {
        return ResponseEntity.ok(ApiResponse.success(listService.addSection(id, request)));
    }

    @PatchMapping("/task-lists/{id}/sections/{sectionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> updateSection(@PathVariable UUID id, @PathVariable UUID sectionId,
                                                                                      @Valid @RequestBody TaskListRequests.Section request) {
        return ResponseEntity.ok(ApiResponse.success(listService.updateSection(id, sectionId, request)));
    }

    @DeleteMapping("/task-lists/{id}/sections/{sectionId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> deleteSection(@PathVariable UUID id, @PathVariable UUID sectionId) {
        return ResponseEntity.ok(ApiResponse.success(listService.deleteSection(id, sectionId)));
    }

    // ── Việc trong danh sách ──

    @PostMapping("/task-lists/{id}/items")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thêm một việc gốc vào danh sách")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> addItem(@PathVariable UUID id, @Valid @RequestBody TaskListRequests.Item request) {
        return ResponseEntity.ok(ApiResponse.success(listService.addItem(id, request)));
    }

    @PutMapping("/task-lists/{id}/items")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chuyển nhóm / đổi thứ tự của một việc trong danh sách")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> moveItem(@PathVariable UUID id, @Valid @RequestBody TaskListRequests.Item request) {
        return ResponseEntity.ok(ApiResponse.success(listService.moveItem(id, request)));
    }

    @DeleteMapping("/task-lists/{id}/items/{taskId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> removeItem(@PathVariable UUID id, @PathVariable UUID taskId) {
        listService.removeItem(id, taskId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    // ── Trường tuỳ chỉnh ──

    @PostMapping("/task-lists/{id}/fields")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> addField(@PathVariable UUID id,
                                                                                 @Valid @RequestBody TaskListRequests.Field request) {
        return ResponseEntity.ok(ApiResponse.success(listService.addField(id, request)));
    }

    @PatchMapping("/task-lists/{id}/fields/{fieldId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> updateField(@PathVariable UUID id, @PathVariable UUID fieldId,
                                                                                    @Valid @RequestBody TaskListRequests.Field request) {
        return ResponseEntity.ok(ApiResponse.success(listService.updateField(id, fieldId, request)));
    }

    @DeleteMapping("/task-lists/{id}/fields/{fieldId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.TaskListDetail>> deleteField(@PathVariable UUID id, @PathVariable UUID fieldId) {
        return ResponseEntity.ok(ApiResponse.success(listService.deleteField(id, fieldId)));
    }

    @PutMapping("/kpi-tasks/{taskId}/fields/{fieldId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Đặt / xoá giá trị trường tuỳ chỉnh của một việc")
    public ResponseEntity<ApiResponse<KpiTaskResponse>> setFieldValue(@PathVariable UUID taskId, @PathVariable UUID fieldId,
                                                                      @RequestBody TaskListRequests.FieldValue request) {
        return ResponseEntity.ok(ApiResponse.success(listService.setFieldValue(taskId, fieldId, request)));
    }

    // ── Chế độ xem đã lưu ──

    @GetMapping("/task-views")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Chế độ xem của tôi + chế độ xem chia sẻ trong danh sách tôi là thành viên")
    public ResponseEntity<ApiResponse<List<TaskListResponses.SavedView>>> views() {
        return ResponseEntity.ok(ApiResponse.success(listService.views()));
    }

    @PostMapping("/task-views")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.SavedView>> createView(@Valid @RequestBody TaskListRequests.SavedView request) {
        return ResponseEntity.ok(ApiResponse.success(listService.createView(request)));
    }

    @PatchMapping("/task-views/{viewId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.SavedView>> updateView(@PathVariable UUID viewId,
                                                                              @Valid @RequestBody TaskListRequests.SavedView request) {
        return ResponseEntity.ok(ApiResponse.success(listService.updateView(viewId, request)));
    }

    @DeleteMapping("/task-views/{viewId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteView(@PathVariable UUID viewId) {
        listService.deleteView(viewId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    // ── Mẫu ──

    @GetMapping("/task-list-templates")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mẫu có sẵn + mẫu của tổ chức")
    public ResponseEntity<ApiResponse<List<TaskListResponses.Template>>> templates() {
        return ResponseEntity.ok(ApiResponse.success(listService.templates()));
    }

    @PostMapping("/task-lists/{id}/save-as-template")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.Template>> saveAsTemplate(@PathVariable UUID id,
                                                                                 @Valid @RequestBody TaskListRequests.Template request) {
        return ResponseEntity.ok(ApiResponse.success(listService.saveAsTemplate(id, request)));
    }

    @DeleteMapping("/task-list-templates/{templateId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteTemplate(@PathVariable UUID templateId) {
        listService.deleteTemplate(templateId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    // ── Tự động hoá ──

    @GetMapping("/task-lists/{id}/automations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<TaskListResponses.Automation>>> automations(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(listService.automations(id)));
    }

    @PostMapping("/task-lists/{id}/automations")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.Automation>> createAutomation(@PathVariable UUID id,
                                                                                     @Valid @RequestBody TaskListRequests.Automation request) {
        return ResponseEntity.ok(ApiResponse.success(listService.createAutomation(id, request)));
    }

    @PatchMapping("/task-lists/{id}/automations/{automationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TaskListResponses.Automation>> updateAutomation(@PathVariable UUID id, @PathVariable UUID automationId,
                                                                                     @Valid @RequestBody TaskListRequests.Automation request) {
        return ResponseEntity.ok(ApiResponse.success(listService.updateAutomation(id, automationId, request)));
    }

    @DeleteMapping("/task-lists/{id}/automations/{automationId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> deleteAutomation(@PathVariable UUID id, @PathVariable UUID automationId) {
        listService.deleteAutomation(id, automationId);
        return ResponseEntity.ok(ApiResponse.success((Void) null));
    }

    // ── Thống kê, nhập / xuất ──

    @GetMapping("/task-lists/{id}/stats")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Thống kê việc của danh sách (chỉ việc người xem thấy được)")
    public ResponseEntity<ApiResponse<TaskListResponses.Stats>> stats(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(listService.stats(id)));
    }

    @GetMapping("/task-lists/import-template")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> importTemplate() throws IOException {
        return file(excelService.importTemplate(), "task-import-template.xlsx");
    }

    @PostMapping(value = "/task-lists/{id}/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Xem trước tệp nhập (.xlsx theo mẫu) — kiểm từng dòng")
    public ResponseEntity<ApiResponse<TaskListResponses.ImportPreview>> importPreview(@PathVariable UUID id,
                                                                                     @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(excelService.preview(id, file)));
    }

    @PostMapping("/task-lists/{id}/import")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Nhập các dòng đã xem trước vào danh sách")
    public ResponseEntity<ApiResponse<TaskListResponses.ImportResult>> importCommit(@PathVariable UUID id,
                                                                                   @Valid @RequestBody TaskListRequests.ImportCommit request) {
        return ResponseEntity.ok(ApiResponse.success(excelService.commit(id, request)));
    }

    static ResponseEntity<byte[]> file(byte[] bytes, String name) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + name + "\"")
                .contentType(MediaType.parseMediaType(XLSX))
                .body(bytes);
    }
}
