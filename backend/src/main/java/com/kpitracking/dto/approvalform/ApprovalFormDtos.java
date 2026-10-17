package com.kpitracking.dto.approvalform;

import com.kpitracking.dto.response.kpi.approval.ApprovalSummaryResponse;
import com.kpitracking.dto.response.kpi.approval.KpiApprovalChainResponse;
import com.kpitracking.dto.response.approvalprocess.ApprovalProcessCatalogResponse;
import com.kpitracking.entity.form.FormAdmin;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormSubmitters;
import com.kpitracking.enums.ApprovalRequestStatus;
import com.kpitracking.enums.FormAdminPermission;
import com.kpitracking.enums.FormSubmitterScope;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Request / response của mục Đơn từ. Tên và mô tả nhóm / đơn luôn đi dạng song ngữ {@code {"vi": …, "en": …}};
 * giao diện chọn theo ngôn ngữ người xem.
 */
public final class ApprovalFormDtos {

    private ApprovalFormDtos() {}

    // ── Request ─────────────────────────────────────────────────────────────

    public record GroupRequest(@NotNull Map<String, String> name) {}

    public record OrderRequest(@NotNull List<UUID> ids) {}

    public record NamesRequest(@NotNull Map<String, String> name, Map<String, String> description) {}

    /** Lưu đơn (Phát hành). Người quản lý đơn chỉ đổi được phần mình có quyền; phần còn lại giữ nguyên. */
    public record FormRequest(
            @NotNull UUID groupId,
            String templateCode,
            String icon,
            String color,
            Map<String, String> name,
            Map<String, String> description,
            FormSubmitterScope submitterScope,
            FormSubmitters submitters,
            List<FormAdmin> admins,
            FormSchema schema,
            ProcessGraph process,
            Long version) {}

    public record SubmitRequest(@NotNull UUID formId, @NotNull UUID orgUnitId, Map<String, Object> values) {}

    // ── Response: quản trị ──────────────────────────────────────────────────

    public record Person(UUID id, String name, String avatarUrl) {}

    public record Ref(UUID id, String name) {}

    public record FormSummary(UUID id, UUID groupId, String templateCode, String icon, String color,
                              Map<String, String> name, Map<String, String> description, boolean active,
                              FormSubmitterScope submitterScope, int submitterCount,
                              List<FormAdminPermission> permissions) {}

    public record Group(UUID id, Map<String, String> name, boolean active, int sortOrder, String code,
                        List<FormSummary> forms) {}

    /** {@code canManageAll}: có APPROVAL_FORM:MANAGE (nhóm, tạo đơn, mọi đơn). */
    public record AdminView(List<Group> groups, boolean canManageAll) {}

    public record AdminEntry(Person user, List<FormAdminPermission> permissions) {}

    public record FormDetail(UUID id, UUID groupId, String templateCode, String icon, String color,
                             Map<String, String> name, Map<String, String> description,
                             FormSubmitterScope submitterScope, List<Person> submitterUsers, List<Ref> submitterUnits,
                             List<AdminEntry> admins, FormSchema schema, ProcessGraph process,
                             Map<UUID, Person> refUsers, boolean active, long version,
                             List<FormAdminPermission> permissions, Instant updatedAt,
                             // Quy trình đang bật ở màn Quy trình duyệt cho đơn này — thay sơ đồ riêng khi nộp.
                             Ref managedProcess) {}

    public record LibraryCategory(String code, Map<String, String> name) {}

    public record LibraryTemplate(String code, String category, boolean recommended, String icon, String color,
                                  Map<String, String> name, Map<String, String> description,
                                  FormSchema schema, ProcessGraph process) {}

    public record Library(List<LibraryCategory> categories, List<LibraryTemplate> templates) {}

    /** Danh sách chọn cho bước "Quy trình duyệt" — không đòi quyền ROLE/ORG/USER:VIEW. */
    public record UnitOption(UUID id, String name, int depth) {}

    public record ProcessOptions(ApprovalProcessCatalogResponse catalog, List<Ref> roles, List<Ref> levels,
                                 List<UnitOption> units) {}

    // ── Response: nhân viên ─────────────────────────────────────────────────

    public record CatalogForm(UUID id, String icon, String color, Map<String, String> name,
                              Map<String, String> description) {}

    public record CatalogGroup(UUID id, Map<String, String> name, List<CatalogForm> forms) {}

    /** {@code canAdmin}: hiện tab Quản trị (có APPROVAL_FORM:MANAGE hoặc đang quản lý ít nhất một đơn). */
    public record Catalog(List<CatalogGroup> groups, boolean canAdmin) {}

    /** Form để nộp: kèm các đơn vị người nộp đang thuộc (chọn đơn vị nộp khi có nhiều). */
    public record SubmitView(UUID id, String icon, String color, Map<String, String> name,
                             Map<String, String> description, FormSchema schema, List<Ref> units) {}

    public record UploadedFile(String url, String publicId, String name, long size, String contentType) {}

    public record PlannedStep(String code, String name, List<String> approvers, boolean skipped) {}

    /** {@code adminFallback}: không bước nào có người giữ — đơn sẽ chuyển quản trị tổ chức. */
    public record FlowPreview(List<PlannedStep> steps, boolean adminFallback) {}

    public record SummaryField(String title, WidgetType type, Object value) {}

    public record RequestItem(UUID id, String code, UUID formId, Map<String, String> formName, String formIcon,
                              String formColor, Person requester, String orgUnitName, ApprovalRequestStatus status,
                              Instant submittedAt, Instant finishedAt, List<SummaryField> summary,
                              ApprovalSummaryResponse approval) {}

    public record RequestDetail(RequestItem item, FormSchema schema, Map<String, Object> values,
                                String rejectReason, KpiApprovalChainResponse chain, boolean canWithdraw) {}

    public record Counts(long todo, long inReview) {}
}
