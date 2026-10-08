package com.kpitracking.service.discussion;

import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.dto.response.discussion.DiscussionCommentResponse;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.service.CollabITSupport;
import com.kpitracking.service.task.KpiTaskService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tệp đính kèm sao từ thư viện tài liệu (V37) trên PostgreSQL THẬT: chỉ ghi tài liệu gốc mà người đính kèm xem được;
 * link "Mở bản mới nhất" ({@code sourceDocumentId}) chỉ trả cho người xem được tài liệu gốc và ẩn khi tài liệu gốc đã
 * xoá — nhãn tên và bản sao giữ nguyên. Chạy tay: {@code ./mvnw test -Dtest=AttachmentLibrarySourceIT}.
 */
class AttachmentLibrarySourceIT extends CollabITSupport {

    @Autowired AttachmentLibrarySources librarySources;
    @Autowired KpiTaskService taskService;
    @Autowired DiscussionService discussionService;

    private final List<UUID> docs = new ArrayList<>();

    @AfterEach
    void cleanupDocuments() {
        docs.forEach(id -> jdbc.update("DELETE FROM documents WHERE id = ?", id));
    }

    private UUID doc(String title, String scope, UUID owner) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO documents (id, organization_id, scope, owner_user_id, title, file_name, content_type, file_size, "
                + "content_sha256, storage_provider, storage_key, created_by) VALUES (?, ?, ?, ?, ?, 'a.pdf', 'application/pdf', 1, "
                + "'x', 'CLOUDINARY', 'k', ?)", id, orgId, scope, "PERSONAL".equals(scope) ? owner : null, title, owner);
        docs.add(id);
        return id;
    }

    private static MockMultipartFile file(String name) {
        return new MockMultipartFile("files", name, "application/pdf", new byte[]{1});
    }

    @Test
    void link_keepsOnlyDocumentsTheUploaderCanView_alignedByPosition() {
        UUID company = doc("Quy trình chung", "COMPANY", head);
        UUID colleaguePrivate = doc("Ghi chú riêng của đồng nghiệp", "PERSONAL", colleague);
        MultipartFile[] files = {file("local.pdf"), file("company.pdf"), file("private.pdf"), file("junk.pdf")};

        Map<MultipartFile, AttachmentLibrarySources.Source> linked = librarySources.link(files,
                List.of("-", company.toString(), colleaguePrivate.toString(), "khong-phai-uuid"), employee, orgId);

        assertThat(linked).hasSize(1);
        assertThat(linked.get(files[1])).isEqualTo(new AttachmentLibrarySources.Source(company, "Quy trình chung"));
        // Không có danh sách id → như tải từ máy.
        assertThat(librarySources.link(files, null, employee, orgId)).isEmpty();
    }

    @Test
    void taskAttachment_linkOnlyForViewersOfSource_hiddenAfterSourceDeleted() {
        UUID mine = doc("Tài liệu riêng của nhân viên", "PERSONAL", employee);
        UUID company = doc("Biểu mẫu công ty", "COMPANY", head);
        loginAs(employee);
        KpiTaskResponse t = taskService.create(CreateKpiTaskRequest.builder().kpiId(kpiId).title("Việc có tệp từ thư viện").build());
        for (UUID d : List.of(mine, company)) {
            jdbc.update("INSERT INTO kpi_task_attachments (task_id, file_name, file_url, file_size, content_type, storage_provider, "
                    + "storage_key, uploaded_by, source_document_id, source_document_title) "
                    + "VALUES (?, 'a.pdf', 'https://x/a.pdf', 1, 'application/pdf', 'CLOUDINARY', 'k', ?, ?, ?)",
                    t.getId(), employee, d, d.equals(mine) ? "Tài liệu riêng của nhân viên" : "Biểu mẫu công ty");
        }

        // Người đính kèm xem được cả hai tài liệu gốc.
        assertThat(sourceIds(taskService.get(t.getId()).getAttachments())).containsExactlyInAnyOrder(mine, company);

        // Trưởng đơn vị xem được công việc nhưng không xem được tài liệu riêng của nhân viên: còn nhãn, không link.
        loginAs(head);
        List<KpiTaskResponse.Attachment> forHead = taskService.get(t.getId()).getAttachments();
        assertThat(forHead).allSatisfy(a -> assertThat(a.isFromLibrary()).isTrue());
        assertThat(sourceIds(forHead)).containsExactly(company);
        assertThat(forHead).extracting(KpiTaskResponse.Attachment::getSourceDocumentTitle)
                .containsExactlyInAnyOrder("Tài liệu riêng của nhân viên", "Biểu mẫu công ty");

        // Tài liệu gốc vào thùng rác: link ẩn với mọi người, bản sao + nhãn còn nguyên.
        jdbc.update("UPDATE documents SET deleted_at = now() WHERE id = ?", company);
        List<KpiTaskResponse.Attachment> after = taskService.get(t.getId()).getAttachments();
        assertThat(after).hasSize(2);
        assertThat(sourceIds(after)).isEmpty();
        assertThat(after).allSatisfy(a -> assertThat(a.isFromLibrary()).isTrue());
    }

    @Test
    void commentAttachment_linkFollowsDocumentAccess() throws Exception {
        UUID mine = doc("Bản nháp của nhân viên", "PERSONAL", employee);
        loginAs(employee);
        DiscussionCommentResponse c = discussionService.create(DiscussionTargetType.KPI, kpiId, "Xem tệp này", null, null, null);
        jdbc.update("INSERT INTO discussion_attachments (comment_id, file_name, file_url, file_size, content_type, storage_provider, "
                + "storage_key, uploaded_by, source_document_id, source_document_title) "
                + "VALUES (?, 'a.pdf', 'https://x/a.pdf', 1, 'application/pdf', 'CLOUDINARY', 'k', ?, ?, 'Bản nháp của nhân viên')",
                c.getId(), employee, mine);

        assertThat(attachmentOf(c.getId()).getSourceDocumentId()).isEqualTo(mine);
        loginAs(head);
        DiscussionCommentResponse.Attachment forHead = attachmentOf(c.getId());
        assertThat(forHead.isFromLibrary()).isTrue();
        assertThat(forHead.getSourceDocumentTitle()).isEqualTo("Bản nháp của nhân viên");
        assertThat(forHead.getSourceDocumentId()).isNull();
    }

    private DiscussionCommentResponse.Attachment attachmentOf(UUID commentId) {
        return discussionService.page(DiscussionTargetType.KPI, kpiId, null, null).getContent().stream()
                .filter(x -> x.getId().equals(commentId)).findFirst().orElseThrow().getAttachments().get(0);
    }

    private static List<UUID> sourceIds(List<KpiTaskResponse.Attachment> list) {
        return list.stream().map(KpiTaskResponse.Attachment::getSourceDocumentId).filter(java.util.Objects::nonNull).toList();
    }
}
