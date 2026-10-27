package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.dto.request.task.SetTaskAssigneesRequest;
import com.kpitracking.dto.response.task.KpiTaskEventResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.task.KpiTaskAttachment;
import com.kpitracking.enums.task.KpiTaskAttachmentKind;
import com.kpitracking.enums.task.KpiTaskEventAction;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.repository.task.KpiTaskAttachmentRepository;
import com.kpitracking.service.CollabITSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tệp đính kèm vs. kết quả của công việc (V47) trên PostgreSQL THẬT. Tệp được ghi thẳng vào bảng (không có
 * {@code storageKey} ⇒ không chạm Cloudinary). Luật: {@code KpiTaskAccess.Scope.canRemoveFile}.
 * Chạy tay: {@code ./mvnw test -Dtest=TaskResultFilesIT}.
 */
class TaskResultFilesIT extends CollabITSupport {

    @Autowired KpiTaskService taskService;
    @Autowired KpiTaskAttachmentRepository attachmentRepository;

    private Instant started;

    @BeforeEach
    void mark() {
        started = Instant.now().minusSeconds(1);
    }

    @AfterEach
    void cleanup() {
        jdbc.update("DELETE FROM notifications WHERE reference_id IN (SELECT id FROM kpi_tasks WHERE created_by = ? AND created_at >= ?)",
                head, java.sql.Timestamp.from(started));
        jdbc.update("DELETE FROM kpi_tasks WHERE created_by = ? AND created_at >= ? AND kpi_criteria_id IS NULL",
                head, java.sql.Timestamp.from(started));
    }

    private UUID file(UUID taskId, UUID uploadedBy, KpiTaskAttachmentKind kind, String name) {
        return attachmentRepository.save(KpiTaskAttachment.builder().taskId(taskId).kind(kind).fileName(name)
                .fileUrl("https://example.invalid/" + name).storageProvider(StorageProvider.CLOUDINARY)
                .uploadedBy(uploadedBy).build()).getId();
    }

    private static KpiTaskResponse.Attachment find(KpiTaskResponse r, UUID id) {
        return r.getAttachments().stream().filter(a -> a.getId().equals(id)).findFirst().orElseThrow();
    }

    @Test
    void assigneeCannotRemoveAssignersAttachment_butRemovesOwnResult() {
        loginAs(head);
        KpiTaskResponse task = taskService.create(CreateKpiTaskRequest.builder().title("Việc giao xuống")
                .assigneeIds(List.of(employee)).build());
        UUID brief = file(task.getId(), head, KpiTaskAttachmentKind.REFERENCE, "de-bai.pdf");
        UUID result = file(task.getId(), employee, KpiTaskAttachmentKind.RESULT, "bao-cao.pdf");

        // Người thực hiện: thấy cả hai loại, chỉ xoá được kết quả của mình
        loginAs(employee);
        KpiTaskResponse seen = taskService.get(task.getId());
        assertThat(find(seen, brief).getKind()).isEqualTo(KpiTaskAttachmentKind.REFERENCE);
        assertThat(find(seen, brief).isCanDelete()).isFalse();
        assertThat(find(seen, result).getKind()).isEqualTo(KpiTaskAttachmentKind.RESULT);
        assertThat(find(seen, result).isCanDelete()).isTrue();
        assertThat(find(seen, result).getUploadedById()).isEqualTo(employee);
        assertThat(find(seen, result).getUploadedByName()).isNotBlank();
        assertThatThrownBy(() -> taskService.deleteAttachment(task.getId(), brief))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FILE_REMOVE_NOT_ALLOWED));

        // Người giao: xoá được tệp đính kèm, KHÔNG xoá được kết quả người thực hiện đang nộp
        loginAs(head);
        KpiTaskResponse asHead = taskService.get(task.getId());
        assertThat(find(asHead, brief).isCanDelete()).isTrue();
        assertThat(find(asHead, result).isCanDelete()).isFalse();
        assertThatThrownBy(() -> taskService.deleteAttachment(task.getId(), result))
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.TASK_FILE_REMOVE_NOT_ALLOWED));

        // Người thực hiện xoá kết quả của mình ⇒ có dòng lịch sử
        loginAs(employee);
        KpiTaskResponse after = taskService.deleteAttachment(task.getId(), result);
        assertThat(after.getAttachments()).extracting(KpiTaskResponse.Attachment::getId).containsExactly(brief);
        assertThat(taskService.history(task.getId())).extracting(KpiTaskEventResponse::getAction)
                .contains(KpiTaskEventAction.RESULT_REMOVED);
    }

    @Test
    void assignerCleansUpResult_onlyAfterUploaderLeftTheTask() {
        loginAs(head);
        KpiTaskResponse task = taskService.create(CreateKpiTaskRequest.builder().title("Việc đổi người làm")
                .assigneeIds(List.of(employee)).build());
        UUID result = file(task.getId(), employee, KpiTaskAttachmentKind.RESULT, "ban-nhap.docx");

        KpiTaskResponse moved = taskService.setAssignees(task.getId(), SetTaskAssigneesRequest.builder()
                .assigneeIds(List.of(colleague)).version(taskService.get(task.getId()).getVersion()).build());
        assertThat(find(moved, result).isCanDelete()).isTrue();
        assertThat(taskService.deleteAttachment(task.getId(), result).getAttachments()).isEmpty();
    }

    @Test
    void outsiderCannotRemoveAnything() {
        loginAs(head);
        KpiTaskResponse task = taskService.create(CreateKpiTaskRequest.builder().title("Việc riêng")
                .assigneeIds(List.of(employee)).build());
        UUID brief = file(task.getId(), head, KpiTaskAttachmentKind.REFERENCE, "de-bai.pdf");
        loginAs(colleague);
        assertThatThrownBy(() -> taskService.deleteAttachment(task.getId(), brief))
                .satisfies(e -> assertThat(codeOf(e)).isIn(ErrorCode.TASK_NO_PERMISSION_VIEW, ErrorCode.TASK_NO_PERMISSION_EDIT));
    }
}
