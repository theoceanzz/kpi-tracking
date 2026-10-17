package com.kpitracking.service.approvalform;

import com.kpitracking.dto.approvalform.ApprovalFormDtos.*;

import com.kpitracking.entity.form.FormAdmin;
import com.kpitracking.entity.form.FormSchema;
import com.kpitracking.entity.form.FormSubmitters;
import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.enums.approvalform.FormAdminPermission;
import com.kpitracking.enums.approvalform.FormSubmitterScope;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.SupportedLanguages;
import com.kpitracking.i18n.Terms;

import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.approvalprocess.ApprovalProcessService;
import com.kpitracking.service.approvalprocess.ProcessGraph;
import com.kpitracking.service.approvalprocess.ProcessGraphCodec;
import com.kpitracking.service.approvalprocess.ProcessGraphValidator;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.approvalform.ApprovalForm;
import com.kpitracking.entity.approvalform.ApprovalFormGroup;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.repository.access.RoleRepository;
import com.kpitracking.repository.approvalform.ApprovalFormGroupRepository;
import com.kpitracking.repository.approvalform.ApprovalFormRepository;
import com.kpitracking.repository.approvalprocess.ApprovalProcessRepository;
import com.kpitracking.repository.organization.OrgHierarchyLevelRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
/**
 * Quản trị đơn từ: nhóm đơn, đơn (thông tin, form, quy trình), thư viện mẫu.
 *
 * <p>Hai mức quyền: {@code APPROVAL_FORM:MANAGE} quản lý tất cả; người quản lý đơn (Process administrator) chỉ làm
 * được trên đơn của mình theo {@link FormAdminPermission}. Khi họ lưu đơn, phần họ không có quyền sửa bị bỏ qua
 * (giữ bản đang lưu) thay vì báo lỗi — giao diện gửi cả đơn lên.
 *
 * <p>Tổ chức luôn suy từ người đăng nhập, không nhận từ client. Người / đơn vị / chức vụ nhắc trong đơn phải thuộc tổ chức.
 */
@Service
@RequiredArgsConstructor
public class ApprovalFormService {

    public static final String PERM_MANAGE = "APPROVAL_FORM:MANAGE";
    private static final int MAX_NAME = 100;
    private static final int MAX_DESCRIPTION = 500;
    private static final Pattern ICON = Pattern.compile("[a-z0-9-]{1,40}");
    private static final Pattern COLOR = Pattern.compile("[a-z]{1,20}");

    private final ApprovalFormGroupRepository groupRepository;
    private final ApprovalFormRepository formRepository;
    private final ApprovalFormSeeder seeder;
    private final ApprovalFormLibrary library;
    private final ProcessGraphCodec codec;
    private final ApprovalProcessService processService;
    private final KpiWorkflowConfigService workflowConfigService;
    private final PermissionChecker permissionChecker;
    private final UserRepository userRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final RoleRepository roleRepository;
    private final OrgHierarchyLevelRepository levelRepository;
    private final UserRoleOrgUnitRepository assignmentRepository;
    private final com.kpitracking.repository.approvalprocess.ApprovalProcessRepository processRepository;

    // ── Danh sách quản trị ──────────────────────────────────────────────────

    /** Nhóm + đơn người gọi quản lý được: tất cả nếu có APPROVAL_FORM:MANAGE, không thì chỉ đơn mình quản lý. */
    @Transactional(readOnly = true)
    public AdminView adminView() {
        UUID orgId = organizationId();
        seeder.ensureSeeded(orgId);
        User me = currentUser();
        boolean manager = isManager(me.getId());
        Map<UUID, List<FormSummary>> byGroup = new HashMap<>();
        for (ApprovalForm f : formRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId)) {
            List<FormAdminPermission> perms = permissionsOf(f, me.getId(), manager);
            if (perms.isEmpty()) continue;
            byGroup.computeIfAbsent(f.getGroupId(), k -> new ArrayList<>()).add(summary(f, perms));
        }
        List<Group> groups = new ArrayList<>();
        for (ApprovalFormGroup g : groupRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId)) {
            List<FormSummary> forms = byGroup.getOrDefault(g.getId(), List.of());
            if (!manager && forms.isEmpty()) continue;
            groups.add(group(g, forms));
        }
        return new AdminView(groups, manager);
    }

    // ── Nhóm (chỉ APPROVAL_FORM:MANAGE) ─────────────────────────────────────

    @Transactional
    public Group createGroup(GroupRequest request) {
        UUID orgId = requireManager();
        int next = groupRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).stream()
                .mapToInt(ApprovalFormGroup::getSortOrder).max().orElse(-1) + 1;
        ApprovalFormGroup g = groupRepository.save(ApprovalFormGroup.builder()
                .organizationId(orgId).name(names(request.name(), MAX_NAME, true)).sortOrder(next).build());
        return group(g, List.of());
    }

    @Transactional
    public Group updateGroup(UUID id, GroupRequest request) {
        ApprovalFormGroup g = loadGroup(id, requireManager());
        g.setName(names(request.name(), MAX_NAME, true));
        return group(g, List.of());
    }

    @Transactional
    public void setGroupActive(UUID id, boolean active) {
        loadGroup(id, requireManager()).setActive(active);
    }

    /** Chỉ xoá được nhóm rỗng. */
    @Transactional
    public void deleteGroup(UUID id) {
        ApprovalFormGroup g = loadGroup(id, requireManager());
        if (formRepository.countByGroupId(id) > 0) throw new BusinessException(ErrorCode.APPROVAL_FORM_GROUP_NOT_EMPTY);
        g.setDeletedAt(Instant.now());
    }

    @Transactional
    public void reorderGroups(List<UUID> ids) {
        UUID orgId = requireManager();
        Map<UUID, ApprovalFormGroup> groups = new HashMap<>();
        groupRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).forEach(g -> groups.put(g.getId(), g));
        reorder(ids, groups, ApprovalFormGroup::setSortOrder);
    }

    @Transactional
    public void reorderForms(UUID groupId, List<UUID> ids) {
        loadGroup(groupId, requireManager());
        Map<UUID, ApprovalForm> forms = new HashMap<>();
        formRepository.findByGroupIdOrderBySortOrderAscCreatedAtAsc(groupId).forEach(f -> forms.put(f.getId(), f));
        reorder(ids, forms, ApprovalForm::setSortOrder);
    }

    // ── Đơn ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FormDetail get(UUID id) {
        User me = currentUser();
        ApprovalForm f = loadForm(id, organizationId());
        List<FormAdminPermission> perms = permissionsOf(f, me.getId(), isManager(me.getId()));
        if (perms.isEmpty()) throw new ForbiddenException(ErrorCode.APPROVAL_FORM_FORBIDDEN);
        return detail(f, perms);
    }

    @Transactional
    public FormDetail create(FormRequest request) {
        UUID orgId = requireManager();
        User me = currentUser();
        ApprovalForm f = ApprovalForm.builder().organizationId(orgId).createdBy(me).build();
        f.setTemplateCode(request.templateCode() == null || request.templateCode().isBlank() ? null
                : request.templateCode().strip());
        applyBasics(f, request, orgId);
        f.setSortOrder(formRepository.findByGroupIdOrderBySortOrderAscCreatedAtAsc(f.getGroupId()).stream()
                .mapToInt(ApprovalForm::getSortOrder).max().orElse(-1) + 1);
        f.setAdmins(admins(request.admins(), orgId));
        f.setProcessDefinition(codec.write(validProcess(request.process(), f.getFormSchema(), orgId)));
        f.setUpdatedBy(me);
        return detail(formRepository.save(f), List.of(FormAdminPermission.values()));
    }

    @Transactional
    public FormDetail update(UUID id, FormRequest request) {
        UUID orgId = organizationId();
        User me = currentUser();
        ApprovalForm f = loadForm(id, orgId);
        List<FormAdminPermission> perms = permissionsOf(f, me.getId(), isManager(me.getId()));
        if (perms.isEmpty()) throw new ForbiddenException(ErrorCode.APPROVAL_FORM_FORBIDDEN);
        if (request.version() != null && request.version() != f.getVersion()) {
            throw new StaleStateException(ErrorCode.APPROVAL_FORM_CHANGED_RELOAD);
        }
        UUID oldGroup = f.getGroupId();
        if (perms.contains(FormAdminPermission.EDIT_FORM)) applyBasics(f, request, orgId);
        if (!f.getGroupId().equals(oldGroup)) {
            f.setSortOrder(formRepository.findByGroupIdOrderBySortOrderAscCreatedAtAsc(f.getGroupId()).stream()
                    .mapToInt(ApprovalForm::getSortOrder).max().orElse(-1) + 1);
        }
        if (perms.contains(FormAdminPermission.MANAGE_ADMINS)) f.setAdmins(admins(request.admins(), orgId));
        // Form đổi có thể làm điều kiện duyệt trỏ vào widget đã xoá ⇒ luôn kiểm lại quy trình theo form mới.
        ProcessGraph process = perms.contains(FormAdminPermission.MANAGE_PROCESS)
                ? request.process() : codec.tryRead(f.getProcessDefinition()).orElse(null);
        f.setProcessDefinition(codec.write(validProcess(process, f.getFormSchema(), orgId)));
        f.setUpdatedBy(me);
        f.setUpdatedAt(Instant.now());
        formRepository.saveAndFlush(f);
        return detail(f, perms);
    }

    @Transactional
    public void setActive(UUID id, boolean active) {
        requireFormPermission(id, FormAdminPermission.EDIT_FORM).setActive(active);
    }

    /** Xoá mềm. Đơn đã nộp giữ bản chụp form nên vẫn xem / duyệt tiếp được. */
    @Transactional
    public void delete(UUID id) {
        requireFormPermission(id, FormAdminPermission.EDIT_FORM).setDeletedAt(Instant.now());
    }

    @Transactional
    public void rename(UUID id, NamesRequest request) {
        ApprovalForm f = requireFormPermission(id, FormAdminPermission.EDIT_FORM);
        f.setName(names(request.name(), MAX_NAME, true));
        if (request.description() != null) f.setDescription(names(request.description(), MAX_DESCRIPTION, false));
    }

    // ── Thư viện mẫu, danh sách chọn cho quy trình ──────────────────────────

    /** Mẫu trải theo ngôn ngữ của request (form, tên bước); tên / mô tả mẫu giữ song ngữ. */
    @Transactional(readOnly = true)
    public Library library() {
        requireAnyFormAdmin();
        String language = requestLanguage();
        List<LibraryCategory> categories = library.categories().stream()
                .map(c -> new LibraryCategory(c.code(), c.name())).toList();
        List<LibraryTemplate> templates = library.templates().stream()
                .map(t -> new LibraryTemplate(t.code(), t.category(), t.recommended(), t.icon(), t.color(), t.name(),
                        t.description(), library.schema(t, language), library.process(t, language)))
                .toList();
        return new Library(categories, templates);
    }

    @Transactional(readOnly = true)
    public ProcessOptions processOptions() {
        UUID orgId = requireAnyFormAdmin();
        List<Ref> roles = roleRepository.findAllByOrganizationIdAndDeletedAtIsNull(orgId).stream()
                .sorted(Comparator.comparing((Role r) -> r.getRank() == null ? 99 : r.getRank()).thenComparing(Role::getName))
                .map(r -> new Ref(r.getId(), r.getName())).toList();
        List<Ref> levels = levelRepository.findByOrganizationIdOrderByLevelOrderAsc(orgId).stream()
                .map(l -> new Ref(l.getId(), l.getUnitTypeName())).toList();
        List<UnitOption> units = orgUnitRepository.findByOrgHierarchyLevel_Organization_IdAndDeletedAtIsNull(orgId).stream()
                .sorted(Comparator.comparing(u -> u.getPath() == null ? "" : u.getPath()))
                .map(u -> new UnitOption(u.getId(), u.getName(), depthOf(u)))
                .toList();
        return new ProcessOptions(processService.catalog(), roles, levels, units);
    }

    // ── Dùng chung với phía nộp đơn ─────────────────────────────────────────

    public User currentUser() {
        return workflowConfigService.currentUser();
    }

    public UUID organizationId() {
        UUID orgId = workflowConfigService.currentOrganizationId();
        if (orgId == null) throw new BusinessException(ErrorCode.APPROVAL_FORM_NO_ORGANIZATION);
        return orgId;
    }

    public boolean isManager(UUID userId) {
        return permissionChecker.hasPermission(userId, PERM_MANAGE);
    }

    /** Người gọi có quản lý được đơn nào không (để hiện tab Quản trị). */
    public boolean canAdminAny(UUID orgId, UUID userId) {
        if (isManager(userId)) return true;
        return formRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).stream()
                .anyMatch(f -> !permissionsOf(f, userId, false).isEmpty());
    }

    public static List<FormAdminPermission> permissionsOf(ApprovalForm f, UUID userId, boolean manager) {
        if (manager) return List.of(FormAdminPermission.values());
        return f.adminsOrEmpty().stream().filter(a -> userId.equals(a.userId())).findFirst()
                .map(a -> List.copyOf(new LinkedHashSet<>(a.permissionsOrEmpty()))).orElse(List.of());
    }

    /**
     * Người này nộp được đơn không: đơn + nhóm đang bật, và phạm vi cho phép — SPECIFIED khớp người, hoặc một đơn vị
     * người đó đang thuộc nằm trong (hoặc dưới) đơn vị được chọn.
     */
    public boolean canSubmit(ApprovalForm f, ApprovalFormGroup group, UUID userId, List<OrgUnit> myUnits) {
        if (!f.isActive() || group == null || !group.isActive()) return false;
        return switch (f.getSubmitterScope()) {
            case ALL -> true;
            case NONE -> false;
            case SPECIFIED -> {
                FormSubmitters s = f.getSubmitters() == null ? FormSubmitters.none() : f.getSubmitters();
                if (s.userIdsOrEmpty().contains(userId)) yield true;
                if (s.orgUnitIdsOrEmpty().isEmpty()) yield false;
                List<String> scopes = orgUnitRepository.findAllById(s.orgUnitIdsOrEmpty()).stream()
                        .map(OrgUnit::getPath).filter(Objects::nonNull).toList();
                yield myUnits.stream().map(OrgUnit::getPath).filter(Objects::nonNull)
                        .anyMatch(p -> scopes.stream().anyMatch(p::startsWith));
            }
        };
    }

    /** Đơn vị người dùng đang thuộc (phân công còn hạn), theo thứ tự phân công. */
    public List<OrgUnit> unitsOf(UUID userId) {
        Map<UUID, OrgUnit> out = new LinkedHashMap<>();
        Instant now = Instant.now();
        for (UserRoleOrgUnit a : assignmentRepository.findByUserId(userId)) {
            if (a.getExpiresAt() != null && !a.getExpiresAt().isAfter(now)) continue;
            OrgUnit u = a.getOrgUnit();
            if (u != null && u.getDeletedAt() == null) out.putIfAbsent(u.getId(), u);
        }
        return new ArrayList<>(out.values());
    }

    public String requestLanguage() {
        String lang = LocaleContextHolder.getLocale().getLanguage();
        return SupportedLanguages.isSupported(lang) ? lang : SupportedLanguages.DEFAULT;
    }

    // ── Nội bộ ──────────────────────────────────────────────────────────────

    private void applyBasics(ApprovalForm f, FormRequest r, UUID orgId) {
        loadGroup(r.groupId(), orgId);
        if (r.icon() == null || !ICON.matcher(r.icon()).matches() || r.color() == null || !COLOR.matcher(r.color()).matches()
                || r.submitterScope() == null) {
            throw new BusinessException(ErrorCode.APPROVAL_FORM_BAD_SETTING);
        }
        f.setGroupId(r.groupId());
        f.setIcon(r.icon());
        f.setColor(r.color());
        f.setName(names(r.name(), MAX_NAME, true));
        f.setDescription(names(r.description(), MAX_DESCRIPTION, false));
        f.setSubmitterScope(r.submitterScope());
        f.setSubmitters(r.submitterScope() == FormSubmitterScope.SPECIFIED ? submitters(r.submitters(), orgId)
                : FormSubmitters.none());
        FormSchema schema = r.schema() == null ? FormSchema.empty() : r.schema();
        List<FormSchemaValidator.Issue> issues = FormSchemaValidator.validate(schema);
        if (!issues.isEmpty()) throw new BusinessException(ErrorCode.APPROVAL_FORM_INVALID, render(issues.get(0)));
        f.setFormSchema(new FormSchema(new ArrayList<>(schema.widgetsOrEmpty())));
    }

    private ProcessGraph validProcess(ProcessGraph raw, FormSchema schema, UUID orgId) {
        ProcessGraph graph = ApprovalProcessService.normalize(raw);
        ProcessGraphValidator.Result result = ProcessGraphValidator.validate(graph, ApprovalObjectType.FORM_REQUEST,
                FormSchemaValidator.index(schema));
        if (!result.valid()) {
            ProcessGraphValidator.Issue i = result.errors().get(0);
            throw new BusinessException(ErrorCode.APPROVAL_FORM_PROCESS_INVALID,
                    ErrorMessages.text(i.key(), i.key(), i.args().toArray()));
        }
        processService.requireInOrganization(graph, Set.of(), orgId);
        return graph;
    }

    private FormSubmitters submitters(FormSubmitters raw, UUID orgId) {
        FormSubmitters s = raw == null ? FormSubmitters.none() : raw;
        List<UUID> users = s.userIdsOrEmpty().stream().filter(Objects::nonNull).distinct().toList();
        List<UUID> units = s.orgUnitIdsOrEmpty().stream().filter(Objects::nonNull).distinct().toList();
        if (users.isEmpty() && units.isEmpty()) throw new BusinessException(ErrorCode.APPROVAL_FORM_BAD_SETTING);
        for (UUID u : users) {
            if (!permissionChecker.isMemberOfOrganization(u, orgId)) outside();
        }
        List<OrgUnit> found = orgUnitRepository.findAllById(units);
        if (found.size() != units.size() || found.stream().anyMatch(u -> u.getDeletedAt() != null
                || !orgId.equals(PermissionChecker.organizationIdOf(u)))) outside();
        return new FormSubmitters(users, units);
    }

    private List<FormAdmin> admins(List<FormAdmin> raw, UUID orgId) {
        Map<UUID, FormAdmin> out = new LinkedHashMap<>();
        for (FormAdmin a : raw == null ? List.<FormAdmin>of() : raw) {
            if (a == null || a.userId() == null || out.containsKey(a.userId())) continue;
            if (!permissionChecker.isMemberOfOrganization(a.userId(), orgId)) outside();
            List<FormAdminPermission> perms = a.permissionsOrEmpty().stream().filter(Objects::nonNull).distinct()
                    .sorted().toList();
            out.put(a.userId(), new FormAdmin(a.userId(), perms));
        }
        return new ArrayList<>(out.values());
    }

    /** Chỉ giữ khoá vi/en, cắt khoảng trắng, bỏ chữ trống. */
    private static Map<String, String> names(Map<String, String> raw, int max, boolean required) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw != null) {
            for (String lang : SupportedLanguages.ALL) {
                String v = raw.get(lang);
                if (v == null || v.isBlank()) continue;
                String t = v.strip();
                if (t.length() > max) throw new BusinessException(ErrorCode.APPROVAL_FORM_BAD_SETTING);
                out.put(lang, t);
            }
        }
        if (required && out.isEmpty()) throw new BusinessException(ErrorCode.APPROVAL_FORM_NAME_REQUIRED);
        return out;
    }

    private static <T> void reorder(List<UUID> ids, Map<UUID, T> items, java.util.function.ObjIntConsumer<T> setOrder) {
        int order = 0;
        for (UUID id : ids == null ? List.<UUID>of() : ids) {
            T item = items.remove(id);
            if (item != null) setOrder.accept(item, order++);
        }
        // Mục không có trong danh sách gửi lên (vừa thêm ở tab khác) xếp sau, giữ thứ tự cũ.
        for (T rest : items.values()) setOrder.accept(rest, order++);
    }

    private ApprovalForm requireFormPermission(UUID id, FormAdminPermission permission) {
        User me = currentUser();
        ApprovalForm f = loadForm(id, organizationId());
        if (!permissionsOf(f, me.getId(), isManager(me.getId())).contains(permission)) {
            throw new ForbiddenException(ErrorCode.APPROVAL_FORM_FORBIDDEN);
        }
        return f;
    }

    private UUID requireManager() {
        UUID orgId = organizationId();
        if (!isManager(currentUser().getId())) throw new ForbiddenException(ErrorCode.APPROVAL_FORM_FORBIDDEN);
        return orgId;
    }

    private UUID requireAnyFormAdmin() {
        UUID orgId = organizationId();
        if (!canAdminAny(orgId, currentUser().getId())) throw new ForbiddenException(ErrorCode.APPROVAL_FORM_FORBIDDEN);
        return orgId;
    }

    private ApprovalFormGroup loadGroup(UUID id, UUID orgId) {
        return groupRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalFormGroup"), "id", id));
    }

    private ApprovalForm loadForm(UUID id, UUID orgId) {
        return formRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalForm"), "id", id));
    }

    private static int depthOf(OrgUnit u) {
        int depth = 0;
        Set<UUID> seen = new HashSet<>();
        for (OrgUnit p = u.getParent(); p != null && seen.add(p.getId()); p = p.getParent()) depth++;
        return depth;
    }

    private static void outside() {
        throw new BusinessException(ErrorCode.APPROVAL_PROCESS_REFERENCE_OUTSIDE_ORGANIZATION);
    }

    private static String render(FormSchemaValidator.Issue i) {
        return ErrorMessages.text(i.key(), i.key(), i.args().toArray());
    }

    private static Group group(ApprovalFormGroup g, List<FormSummary> forms) {
        return new Group(g.getId(), g.getName(), g.isActive(), g.getSortOrder(), g.getCode(), forms);
    }

    private static FormSummary summary(ApprovalForm f, List<FormAdminPermission> perms) {
        FormSubmitters s = f.getSubmitters() == null ? FormSubmitters.none() : f.getSubmitters();
        return new FormSummary(f.getId(), f.getGroupId(), f.getTemplateCode(), f.getIcon(), f.getColor(), f.getName(),
                f.getDescription(), f.isActive(), f.getSubmitterScope(),
                s.userIdsOrEmpty().size() + s.orgUnitIdsOrEmpty().size(), perms);
    }

    private FormDetail detail(ApprovalForm f, List<FormAdminPermission> perms) {
        FormSubmitters s = f.getSubmitters() == null ? FormSubmitters.none() : f.getSubmitters();
        ProcessGraph process = codec.tryRead(f.getProcessDefinition()).orElse(null);
        Set<UUID> userIds = new HashSet<>(s.userIdsOrEmpty());
        f.adminsOrEmpty().forEach(a -> userIds.add(a.userId()));
        if (process != null) userIds.addAll(ApprovalProcessService.referencedUsers(process));
        Map<UUID, Person> people = new HashMap<>();
        for (User u : userRepository.findAllById(userIds)) people.put(u.getId(), person(u));

        Map<UUID, Person> refUsers = new LinkedHashMap<>();
        if (process != null) {
            ApprovalProcessService.referencedUsers(process).forEach(id -> {
                if (people.containsKey(id)) refUsers.put(id, people.get(id));
            });
        }
        List<Ref> units = orgUnitRepository.findAllById(s.orgUnitIdsOrEmpty()).stream()
                .map(u -> new Ref(u.getId(), u.getName())).toList();
        return new FormDetail(f.getId(), f.getGroupId(), f.getTemplateCode(), f.getIcon(), f.getColor(), f.getName(),
                f.getDescription(), f.getSubmitterScope(),
                s.userIdsOrEmpty().stream().map(people::get).filter(Objects::nonNull).toList(), units,
                f.adminsOrEmpty().stream().filter(a -> people.containsKey(a.userId()))
                        .map(a -> new AdminEntry(people.get(a.userId()), a.permissionsOrEmpty())).toList(),
                f.getFormSchema(), process, refUsers, f.isActive(), f.getVersion(), perms,
                f.getUpdatedAt() == null ? f.getCreatedAt() : f.getUpdatedAt(), managedProcessOf(f));
    }

    /** Quy trình ở màn Quy trình duyệt đang bật cho đúng đơn này (nếu có) — khi nộp nó thắng sơ đồ riêng. */
    private Ref managedProcessOf(ApprovalForm f) {
        if (f.getId() == null) return null;
        String id = f.getId().toString();
        return processRepository.findByOrganizationIdAndObjectTypeAndActiveTrue(f.getOrganizationId(),
                        com.kpitracking.enums.approvalprocess.ApprovalObjectType.FORM_REQUEST).stream()
                .filter(p -> p.subObjectsOrEmpty().contains(id))
                .findFirst().map(p -> new Ref(p.getId(), p.getTitle())).orElse(null);
    }

    static Person person(User u) {
        return new Person(u.getId(), u.getFullName(), u.getAvatarUrl());
    }
}
