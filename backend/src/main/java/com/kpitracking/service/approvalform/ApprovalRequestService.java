package com.kpitracking.service.approvalform;

import com.kpitracking.dto.approvalform.ApprovalFormDtos.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.kpi.approval.ApprovalSummaryResponse;
import com.kpitracking.entity.*;
import com.kpitracking.entity.form.FormOption;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormWidget;
import com.kpitracking.enums.ApprovalFlowStatus;
import com.kpitracking.enums.ApprovalRequestStatus;
import com.kpitracking.enums.ApprovalSubjectType;
import com.kpitracking.enums.WidgetType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.LocalizedText;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.CloudinaryStorageService;
import com.kpitracking.service.approvalprocess.ApprovalProcessPlanner;
import com.kpitracking.service.approvalprocess.ApprovalSubjectFacts;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import com.kpitracking.service.approvalprocess.ProcessGraphCodec;
import com.kpitracking.service.discussion.CollabAttachmentPolicy;
import com.kpitracking.service.kpi.approval.KpiApprovalChainService;
import com.kpitracking.service.kpi.approval.KpiApprovalViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Phía nhân viên của Đơn từ: danh mục đơn được nộp, nộp đơn, các mục của trang "Trạng thái đơn", xem / rút đơn.
 * Duyệt và từ chối đi qua {@code /api/v1/approvals/flows/{id}/approve|reject} chung — {@link FormRequestApprovalHandler}
 * áp kết quả vào đơn.
 */
@Service
@RequiredArgsConstructor
public class ApprovalRequestService {

    public enum Box { TODO, DONE, SUBMITTED, IN_REVIEW }

    private static final int MAX_PAGE_SIZE = 100;
    private static final int SUMMARY_FIELDS = 3;
    private static final DateTimeFormatter CODE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Set<WidgetType> SUMMARY_TYPES = EnumSet.of(WidgetType.TEXT, WidgetType.TEXTAREA,
            WidgetType.NUMBER, WidgetType.AMOUNT, WidgetType.FORMULA, WidgetType.RADIO, WidgetType.CHECKBOX,
            WidgetType.DATE, WidgetType.DATE_RANGE, WidgetType.CONTACT, WidgetType.DEPARTMENT, WidgetType.PHONE);

    private final ApprovalFormService formService;
    private final ApprovalFormSeeder seeder;
    private final ApprovalFormRepository formRepository;
    private final ApprovalFormGroupRepository groupRepository;
    private final ApprovalRequestRepository requestRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final PermissionChecker permissionChecker;
    private final ProcessGraphCodec codec;
    private final ApprovalProcessPlanner planner;
    private final KpiApprovalChainService chainService;
    private final KpiApprovalViewService viewService;
    private final CloudinaryStorageService storage;
    private final CollabAttachmentPolicy attachmentPolicy;

    // ── Nộp đơn ─────────────────────────────────────────────────────────────

    /** Nhóm + đơn người gọi được nộp (nhóm rỗng bị ẩn). */
    @Transactional(readOnly = true)
    public Catalog catalog() {
        UUID orgId = formService.organizationId();
        seeder.ensureSeeded(orgId);
        User me = formService.currentUser();
        List<OrgUnit> myUnits = formService.unitsOf(me.getId());
        Map<UUID, ApprovalFormGroup> groups = new LinkedHashMap<>();
        groupRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).forEach(g -> groups.put(g.getId(), g));
        Map<UUID, List<CatalogForm>> byGroup = new HashMap<>();
        for (ApprovalForm f : formRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId)) {
            if (!formService.canSubmit(f, groups.get(f.getGroupId()), me.getId(), myUnits)) continue;
            byGroup.computeIfAbsent(f.getGroupId(), k -> new ArrayList<>())
                    .add(new CatalogForm(f.getId(), f.getIcon(), f.getColor(), f.getName(), f.getDescription()));
        }
        List<CatalogGroup> out = new ArrayList<>();
        for (ApprovalFormGroup g : groups.values()) {
            List<CatalogForm> forms = byGroup.get(g.getId());
            if (forms != null) out.add(new CatalogGroup(g.getId(), g.getName(), forms));
        }
        return new Catalog(out, formService.canAdminAny(orgId, me.getId()));
    }

    @Transactional(readOnly = true)
    public SubmitView submitView(UUID formId) {
        User me = formService.currentUser();
        ApprovalForm f = submittable(formId, formService.organizationId(), me);
        List<Ref> units = formService.unitsOf(me.getId()).stream().map(u -> new Ref(u.getId(), u.getName())).toList();
        return new SubmitView(f.getId(), f.getIcon(), f.getColor(), f.getName(), f.getDescription(), f.getFormSchema(), units);
    }

    /** Đẩy tệp của widget Ảnh / Tệp lên kho trước khi nộp. Không ghi DB nên không cần transaction. */
    public List<UploadedFile> upload(MultipartFile[] files) throws IOException {
        UUID orgId = formService.organizationId();
        User me = formService.currentUser();
        attachmentPolicy.validate(files, 0, FormSchemaValidator.MAX_FILES, ErrorCode.APPROVAL_REQUEST_TOO_MANY_FILES);
        List<UploadedFile> out = new ArrayList<>();
        for (MultipartFile file : files == null ? new MultipartFile[0] : files) {
            CloudinaryStorageService.StoredFile stored = storage.store(file, folderOf(orgId, me.getId()));
            out.add(new UploadedFile(stored.url(), stored.publicId(), attachmentPolicy.safeFileName(file.getOriginalFilename()),
                    file.getSize(), file.getContentType() == null ? "" : file.getContentType()));
        }
        return out;
    }

    /** Các bước duyệt đơn sẽ đi với giá trị đang điền (chưa đủ cũng được) — người nộp thấy trước người duyệt. */
    @Transactional(readOnly = true)
    public FlowPreview previewFlow(SubmitRequest request) {
        UUID orgId = formService.organizationId();
        User me = formService.currentUser();
        ApprovalForm f = submittable(request.formId(), orgId, me);
        OrgUnit unit = unitOf(me, request.orgUnitId());
        FormValues.Result values = FormValues.normalize(f.getFormSchema(), request.values(), lookup(orgId, me), false);
        Optional<ApprovalProcessPlanner.ProcessPlan> plan = plan(f, unit, me, values);
        if (plan.isEmpty()) return new FlowPreview(List.of(), true);
        List<PlannedStep> steps = plan.get().steps().stream()
                .map(s -> new PlannedStep(s.code(), s.name(),
                        s.approvers().stream().map(ApprovalProcessPlanner.Holder::name).toList(), !s.actionable()))
                .toList();
        return new FlowPreview(steps, !plan.get().hasActionableStep());
    }

    @Transactional
    public RequestDetail submit(SubmitRequest request) {
        UUID orgId = formService.organizationId();
        User me = formService.currentUser();
        ApprovalForm f = submittable(request.formId(), orgId, me);
        OrgUnit unit = unitOf(me, request.orgUnitId());
        FormValues.Result values = FormValues.normalize(f.getFormSchema(), request.values(), lookup(orgId, me), true);
        ApprovalProcessPlanner.ProcessPlan plan = plan(f, unit, me, values)
                .orElseThrow(() -> new BusinessException(ErrorCode.APPROVAL_FORM_PROCESS_INVALID, ""));

        String code = LocalDate.now().format(CODE_DATE) + String.format("%06d", requestRepository.nextNumber() % 1_000_000);
        ApprovalRequest r = requestRepository.save(ApprovalRequest.builder()
                .organizationId(orgId)
                .formId(f.getId())
                .code(code)
                .requester(me)
                .orgUnit(unit)
                .formName(new LinkedHashMap<>(f.getName()))
                .formIcon(f.getIcon())
                .formColor(f.getColor())
                .formSnapshot(f.getFormSchema())
                .values(values.values())
                .status(ApprovalRequestStatus.PENDING)
                .build());

        ApprovalSubjectFacts facts = ApprovalSubjectFacts.forForm(unit, me, planner.requesterRoles(me), values.facts());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("requestId", r.getId().toString());
        payload.put("code", code);
        chainService.startPlanned(new KpiApprovalChainService.Subject(ApprovalSubjectType.FORM_REQUEST, r.getId(),
                subjectName(r), unit, facts, payload), plan, me, true);
        return detail(r, me);
    }

    // ── Trạng thái đơn ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<RequestItem> list(Box box, String q, int page, int size) {
        UUID orgId = formService.organizationId();
        User me = formService.currentUser();
        Page<ApprovalRequest> result = requestRepository.findBox(orgId, me.getId(), box.name(), keyword(q),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE)));
        Map<UUID, ApprovalSummaryResponse> approvals = viewService.summariesForSubjects(ApprovalSubjectType.FORM_REQUEST,
                result.getContent().stream().filter(r -> r.getStatus() == ApprovalRequestStatus.PENDING)
                        .map(ApprovalRequest::getId).toList(), me.getId());
        return PageResponse.<RequestItem>builder()
                .content(result.getContent().stream().map(r -> item(r, approvals.get(r.getId()))).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public Counts counts() {
        UUID orgId = formService.organizationId();
        UUID me = formService.currentUser().getId();
        return new Counts(requestRepository.countBox(orgId, me, Box.TODO.name(), ""),
                requestRepository.countBox(orgId, me, Box.IN_REVIEW.name(), ""));
    }

    /** Người nộp, người đang giữ / đã xử lý một bước, và người có APPROVAL_FORM:MANAGE xem được. */
    @Transactional(readOnly = true)
    public RequestDetail detail(UUID id) {
        User me = formService.currentUser();
        ApprovalRequest r = load(id, formService.organizationId());
        boolean allowed = r.getRequester().getId().equals(me.getId())
                || chainService.isSubjectViewer(ApprovalSubjectType.FORM_REQUEST, id, me.getId())
                || formService.isManager(me.getId());
        if (!allowed) throw new ForbiddenException(ErrorCode.APPROVAL_REQUEST_FORBIDDEN);
        return detail(r, me);
    }

    /**
     * Người nộp rút đơn còn chờ duyệt. Khoá flow trước rồi mới đổi đơn — cùng thứ tự với đường duyệt
     * ({@code authorize} khoá flow, handler đổi đơn), nên hai bên chạy cùng lúc thì bên sau nhận 409.
     */
    @Transactional
    public RequestDetail withdraw(UUID id) {
        User me = formService.currentUser();
        ApprovalRequest r = load(id, formService.organizationId());
        if (!r.getRequester().getId().equals(me.getId())) throw new ForbiddenException(ErrorCode.APPROVAL_REQUEST_FORBIDDEN);
        if (r.getStatus() != ApprovalRequestStatus.PENDING) throw new StaleStateException(ErrorCode.APPROVAL_REQUEST_NOT_PENDING);
        Optional<UUID> flowId = chainService.runningSubjectFlowId(ApprovalSubjectType.FORM_REQUEST, id);
        if (flowId.isPresent()) {
            if (chainService.lockFlow(flowId.get()).getStatus() != ApprovalFlowStatus.IN_PROGRESS) {
                throw new StaleStateException(ErrorCode.APPROVAL_REQUEST_NOT_PENDING);
            }
            chainService.cancelRunningSubject(ApprovalSubjectType.FORM_REQUEST, id, me,
                    LocalizedText.of("approvalEvent.reason.requestWithdrawn"));
        }
        r.setStatus(ApprovalRequestStatus.WITHDRAWN);
        r.setFinishedAt(Instant.now());
        return detail(r, me);
    }

    // ── Kết quả duyệt (gọi từ FormRequestApprovalHandler, flow đang khoá) ───

    @Transactional
    public void approveByProcess(UUID id) {
        requestRepository.findById(id).filter(r -> r.getStatus() == ApprovalRequestStatus.PENDING).ifPresent(r -> {
            r.setStatus(ApprovalRequestStatus.APPROVED);
            r.setFinishedAt(Instant.now());
        });
    }

    @Transactional
    public void rejectByProcess(UUID id, String reason) {
        requestRepository.findById(id).filter(r -> r.getStatus() == ApprovalRequestStatus.PENDING).ifPresent(r -> {
            r.setStatus(ApprovalRequestStatus.REJECTED);
            r.setRejectReason(reason);
            r.setFinishedAt(Instant.now());
        });
    }

    // ── Nội bộ ──────────────────────────────────────────────────────────────

    private ApprovalForm submittable(UUID formId, UUID orgId, User me) {
        ApprovalForm f = formRepository.findByIdAndOrganizationId(formId, orgId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalForm"), "id", formId));
        ApprovalFormGroup group = groupRepository.findByIdAndOrganizationId(f.getGroupId(), orgId).orElse(null);
        if (!formService.canSubmit(f, group, me.getId(), formService.unitsOf(me.getId()))) {
            throw new ForbiddenException(ErrorCode.APPROVAL_REQUEST_CANNOT_SUBMIT);
        }
        return f;
    }

    private OrgUnit unitOf(User me, UUID unitId) {
        return formService.unitsOf(me.getId()).stream().filter(u -> u.getId().equals(unitId)).findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.APPROVAL_REQUEST_BAD_UNIT));
    }

    private Optional<ApprovalProcessPlanner.ProcessPlan> plan(ApprovalForm f, OrgUnit unit, User me, FormValues.Result values) {
        ApprovalSubjectFacts facts = ApprovalSubjectFacts.forForm(unit, me, planner.requesterRoles(me), values.facts())
                .withSubObject(f.getId().toString());
        // Quy trình lập ở màn Quy trình duyệt cho đúng đơn này (đang bật) được ưu tiên.
        Optional<ApprovalProcessPlanner.ProcessPlan> managed = planner.plan(facts, unit, me);
        if (managed.isPresent()) return managed;
        Optional<ProcessGraph> graph = codec.tryRead(f.getProcessDefinition());
        if (graph.isEmpty()) return Optional.empty();
        return planner.planGraph(null, ApprovalFormLibrary.pick(f.getName(), orgLanguage(f.getOrganizationId())),
                true, graph.get(), facts, unit, me);
    }

    private FormValues.Lookup lookup(UUID orgId, User me) {
        return new FormValues.Lookup() {
            @Override
            public Map<UUID, String> users(Collection<UUID> ids) {
                Map<UUID, String> out = new HashMap<>();
                for (User u : userRepository.findAllById(ids)) {
                    if (u.getDeletedAt() == null && permissionChecker.isMemberOfOrganization(u.getId(), orgId)) {
                        out.put(u.getId(), u.getFullName());
                    }
                }
                return out;
            }

            @Override
            public Map<UUID, String> units(Collection<UUID> ids) {
                Map<UUID, String> out = new HashMap<>();
                for (OrgUnit u : orgUnitRepository.findAllById(ids)) {
                    if (u.getDeletedAt() == null && orgId.equals(PermissionChecker.organizationIdOf(u))) {
                        out.put(u.getId(), u.getName());
                    }
                }
                return out;
            }

            @Override
            public String uploadFolder() {
                return folderOf(orgId, me.getId());
            }
        };
    }

    private static String folderOf(UUID orgId, UUID userId) {
        return "approval-requests/" + orgId + "/" + userId;
    }

    private String orgLanguage(UUID orgId) {
        return organizationRepository.findById(orgId).map(Organization::getDefaultLanguage)
                .filter(SupportedLanguages::isSupported).orElse(SupportedLanguages.DEFAULT);
    }

    /** Tên đơn trên chuỗi duyệt / thông báo: "Nghỉ phép (20261015000001)". */
    private String subjectName(ApprovalRequest r) {
        String name = ApprovalFormLibrary.pick(r.getFormName(), orgLanguage(r.getOrganizationId()));
        return (name == null ? "" : name + " ") + "(" + r.getCode() + ")";
    }

    private ApprovalRequest load(UUID id, UUID orgId) {
        return requestRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalRequest"), "id", id));
    }

    private RequestDetail detail(ApprovalRequest r, User me) {
        ApprovalSummaryResponse approval = r.getStatus() == ApprovalRequestStatus.PENDING
                ? viewService.summariesForSubjects(ApprovalSubjectType.FORM_REQUEST, List.of(r.getId()), me.getId()).get(r.getId())
                : null;
        return new RequestDetail(item(r, approval), r.getFormSnapshot(), r.getValues(), r.getRejectReason(),
                viewService.chainOfSubject(ApprovalSubjectType.FORM_REQUEST, r.getId(), subjectName(r), me.getId()),
                r.getStatus() == ApprovalRequestStatus.PENDING && r.getRequester().getId().equals(me.getId()));
    }

    private RequestItem item(ApprovalRequest r, ApprovalSummaryResponse approval) {
        return new RequestItem(r.getId(), r.getCode(), r.getFormId(), r.getFormName(), r.getFormIcon(), r.getFormColor(),
                ApprovalFormService.person(r.getRequester()), r.getOrgUnit().getName(), r.getStatus(),
                r.getSubmittedAt(), r.getFinishedAt(), summary(r.getFormSnapshot(), r.getValues()), approval);
    }

    /** Vài trường đầu có giá trị — để dòng danh sách tự nói đơn về việc gì. Phương án / người / đơn vị đổi ra tên. */
    static List<SummaryField> summary(FormSchema schema, Map<String, Object> values) {
        List<SummaryField> out = new ArrayList<>();
        if (schema == null || values == null) return out;
        for (FormWidget w : schema.widgetsOrEmpty()) {
            if (out.size() >= SUMMARY_FIELDS) break;
            if (w == null || !SUMMARY_TYPES.contains(w.type())) continue;
            Object v = values.get(w.id());
            if (v == null) continue;
            out.add(new SummaryField(w.title(), w.type(), display(w, v)));
        }
        return out;
    }

    private static Object display(FormWidget w, Object v) {
        return switch (w.type()) {
            case RADIO -> label(w, v);
            case CHECKBOX -> v instanceof Collection<?> c ? c.stream().map(o -> label(w, o)).toList() : v;
            case CONTACT, DEPARTMENT -> v instanceof Collection<?> c
                    ? c.stream().map(o -> o instanceof Map<?, ?> m ? m.get("name") : o).toList() : v;
            default -> v;
        };
    }

    private static Object label(FormWidget w, Object id) {
        return w.optionsOrEmpty().stream().filter(o -> Objects.equals(o.id(), String.valueOf(id)))
                .map(FormOption::label).findFirst().orElse(String.valueOf(id));
    }

    private static String keyword(String q) {
        if (q == null || q.isBlank()) return "";
        return "%" + q.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
