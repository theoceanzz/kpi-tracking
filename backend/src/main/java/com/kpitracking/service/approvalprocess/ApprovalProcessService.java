package com.kpitracking.service.approvalprocess;

import com.kpitracking.dto.request.approvalprocess.ApprovalProcessRequest;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.approvalprocess.ApprovalProcessCatalogResponse;
import com.kpitracking.dto.response.approvalprocess.ApprovalProcessResponse;
import com.kpitracking.dto.response.approvalprocess.ProcessValidationResponse;
import com.kpitracking.entity.approvalprocess.ApprovalProcess;
import com.kpitracking.entity.organization.OrgUnit;
import com.kpitracking.entity.access.Role;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.approvalprocess.ApprovalObjectType;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.ErrorMessages;
import com.kpitracking.i18n.Terms;
import com.kpitracking.repository.approvalprocess.ApprovalProcessRepository;
import com.kpitracking.repository.organization.OrgUnitRepository;
import com.kpitracking.repository.access.RoleRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.approvalprocess.ProcessGraph.*;
import com.kpitracking.service.kpi.approval.KpiApprovalChainService;
import com.kpitracking.workflow.KpiWorkflowConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Quản lý quy trình duyệt của tổ chức (màn Thiết lập công ty › Quy trình duyệt).
 *
 * <p>Tổ chức luôn suy từ người đang đăng nhập, không nhận từ client (cùng lý do với
 * {@link KpiWorkflowConfigService#currentOrganizationId()}). Mọi người / chức vụ / đơn vị được nhắc
 * trong sơ đồ phải thuộc tổ chức này — nếu không, người ngoài có thể bị chỉ định duyệt KPI.
 */
@Service
@RequiredArgsConstructor
public class ApprovalProcessService {

    private static final String PERM_MANAGE = "WORKFLOW:MANAGE";
    private static final int MAX_PAGE_SIZE = 100;

    private final ApprovalProcessRepository repository;
    private final ProcessGraphCodec codec;
    private final KpiWorkflowConfigService workflowConfigService;
    private final KpiApprovalChainService chainService;
    private final PermissionChecker permissionChecker;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final com.kpitracking.repository.approvalform.ApprovalFormRepository formRepository;
    private final com.kpitracking.repository.approvalform.ApprovalFormGroupRepository formGroupRepository;

    // ── Đọc ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<ApprovalProcessResponse> list(String keyword, ApprovalObjectType objectType, int page, int size) {
        UUID orgId = organizationId();
        String pattern = keyword == null || keyword.isBlank() ? "%" : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ApprovalProcess> result = repository.search(orgId, objectType, pattern, pageable);

        Set<UUID> userIds = new HashSet<>();
        result.forEach(p -> userIds.addAll(p.getFollowerIds()));
        Map<UUID, User> users = usersById(userIds);
        boolean canManage = canManage();

        return PageResponse.<ApprovalProcessResponse>builder()
                .content(result.getContent().stream().map(p -> toResponse(p, users, canManage, false)).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public ApprovalProcessResponse get(UUID id) {
        ApprovalProcess p = load(id, organizationId());
        Set<UUID> userIds = new HashSet<>(p.getFollowerIds());
        codec.tryRead(p.getDefinition()).ifPresent(g -> userIds.addAll(referencedUsers(g)));
        return toResponse(p, usersById(userIds), canManage(), true);
    }

    @Transactional(readOnly = true)
    public ApprovalProcessCatalogResponse catalog() {
        UUID orgId = organizationId();
        return ApprovalProcessCatalogResponse.builder()
                .objects(Arrays.stream(ApprovalObjectType.values())
                        .map(t -> ApprovalProcessCatalogResponse.ObjectType.builder()
                                .code(t.name()).group(t.group()).subObjects(t.subObjects()).available(t.available()).build())
                        .toList())
                .fields(Arrays.stream(ConditionField.values())
                        .map(f -> ApprovalProcessCatalogResponse.Field.builder()
                                .code(f.name())
                                .valueType(f.valueType().name())
                                .operators(f.operators().stream().map(Enum::name).toList())
                                .objects(Arrays.stream(ApprovalObjectType.values()).filter(f::appliesTo).map(Enum::name).toList())
                                .options(f.options())
                                .build())
                        .toList())
                .approverTypes(Arrays.stream(ApproverType.values()).map(Enum::name).toList())
                .maxLevelsUp(ProcessGraphValidator.MAX_LEVELS_UP)
                .chainMode(chainService.isChainMode(orgId))
                .forms(formOptions(orgId))
                .build();
    }

    /**
     * Đơn từ của tổ chức — đối tượng con của "Đơn từ", xếp theo nhóm đơn để người dùng phân biệt khi chọn.
     * Kèm mẫu đơn để điều kiện rẽ nhánh theo được trường của đơn (khi quy trình chọn đúng một đơn).
     */
    private List<ApprovalProcessCatalogResponse.FormOption> formOptions(UUID orgId) {
        String lang = ErrorMessages.currentLocale().getLanguage();
        Map<UUID, com.kpitracking.entity.approvalform.ApprovalFormGroup> groups = new LinkedHashMap<>();
        formGroupRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).forEach(g -> groups.put(g.getId(), g));
        List<UUID> groupOrder = new ArrayList<>(groups.keySet());
        return formRepository.findByOrganizationIdOrderBySortOrderAscCreatedAtAsc(orgId).stream()
                .sorted(Comparator.comparingInt(f -> {
                    int i = groupOrder.indexOf(f.getGroupId());
                    return i < 0 ? Integer.MAX_VALUE : i;
                }))
                .map(f -> {
                    var g = groups.get(f.getGroupId());
                    return ApprovalProcessCatalogResponse.FormOption.builder()
                            .id(f.getId().toString())
                            .name(com.kpitracking.service.approvalform.ApprovalFormLibrary.pick(f.getName(), lang))
                            .groupName(g == null ? null : com.kpitracking.service.approvalform.ApprovalFormLibrary.pick(g.getName(), lang))
                            .active(f.isActive())
                            .schema(f.getFormSchema())
                            .build();
                })
                .toList();
    }

    /** Trường của đơn mà điều kiện dùng được — chỉ khi quy trình gắn đúng MỘT đơn. */
    private FormFieldIndex formIndex(UUID orgId, ApprovalObjectType objectType, List<String> subObjects) {
        if (objectType != ApprovalObjectType.FORM_REQUEST || subObjects == null || subObjects.size() != 1) return null;
        return formRepository.findByIdAndOrganizationId(UUID.fromString(subObjects.get(0)), orgId)
                .map(f -> com.kpitracking.service.approvalform.FormSchemaValidator.index(f.getFormSchema()))
                .orElse(null);
    }

    /** Kiểm sơ đồ mà không lưu — giao diện gọi khi người dùng chỉnh để tô lỗi lên khung vẽ. */
    public ProcessValidationResponse validate(ApprovalProcessRequest request) {
        ProcessGraph graph = request.getDefinition();
        List<String> subs = request.getObjectType() == ApprovalObjectType.FORM_REQUEST && request.getSubObjectTypes() != null
                ? request.getSubObjectTypes().stream().filter(Objects::nonNull).distinct().toList() : List.of();
        ProcessGraphValidator.Result result = ProcessGraphValidator.validate(graph, request.getObjectType(),
                formIndex(organizationId(), request.getObjectType(), subs));
        return ProcessValidationResponse.builder()
                .valid(result.valid())
                .errors(result.errors().stream().map(this::toIssue).toList())
                .warnings(result.warnings().stream().map(this::toIssue).toList())
                .stepCodes(graph == null ? Map.of() : graph.stepCodes())
                .build();
    }

    // ── Ghi ─────────────────────────────────────────────────────────────────

    @Transactional
    public ApprovalProcessResponse create(ApprovalProcessRequest request) {
        UUID orgId = organizationId();
        User actor = workflowConfigService.currentUser();
        ApprovalProcess p = ApprovalProcess.builder()
                .organizationId(orgId)
                .createdBy(actor)
                .build();
        apply(p, request, orgId, actor);
        p = repository.save(p);
        return toResponse(p, usersById(new HashSet<>(p.getFollowerIds())), true, true);
    }

    @Transactional
    public ApprovalProcessResponse update(UUID id, ApprovalProcessRequest request) {
        UUID orgId = organizationId();
        ApprovalProcess p = load(id, orgId);
        if (request.getVersion() != null && request.getVersion() != p.getVersion()) {
            throw new StaleStateException(ErrorCode.APPROVAL_PROCESS_CHANGED_RELOAD);
        }
        apply(p, request, orgId, workflowConfigService.currentUser());
        p = repository.save(p);
        return get(p.getId());
    }

    @Transactional
    public ApprovalProcessResponse setActive(UUID id, boolean active) {
        UUID orgId = organizationId();
        ApprovalProcess p = load(id, orgId);
        if (active && !p.isActive()) requireNoOverlap(p.getId(), orgId, p.getObjectType(), p.subObjectsOrEmpty());
        p.setActive(active);
        p.setUpdatedBy(workflowConfigService.currentUser());
        p = repository.save(p);
        return toResponse(p, usersById(new HashSet<>(p.getFollowerIds())), true, false);
    }

    /** Xoá mềm. Flow đang chạy theo các quy trình này không đổi (đã chụp bước lúc gửi). */
    @Transactional
    public int delete(Collection<UUID> ids) {
        if (ids == null || ids.isEmpty()) return 0;
        UUID orgId = organizationId();
        Instant now = Instant.now();
        User actor = workflowConfigService.currentUser();
        List<ApprovalProcess> found = repository.findByIdInAndOrganizationId(ids, orgId);
        for (ApprovalProcess p : found) {
            p.setDeletedAt(now);
            p.setActive(false);
            p.setUpdatedBy(actor);
        }
        repository.saveAll(found);
        return found.size();
    }

    private void apply(ApprovalProcess p, ApprovalProcessRequest request, UUID orgId, User actor) {
        ApprovalObjectType objectType = request.getObjectType();
        if (!objectType.available()) {
            throw new BusinessException(ErrorCode.APPROVAL_PROCESS_OBJECT_NOT_AVAILABLE);
        }
        List<String> subObjects = objectType.dynamicSubObjects()
                ? normalizeForms(orgId, request.getSubObjectTypes())
                : normalizeSubObjects(objectType, request.getSubObjectTypes());
        ProcessGraph graph = normalize(request.getDefinition());

        ProcessGraphValidator.Result result = ProcessGraphValidator.validate(graph, objectType,
                formIndex(orgId, objectType, subObjects));
        if (!result.valid()) {
            throw new BusinessException(ErrorCode.APPROVAL_PROCESS_INVALID, render(result.errors().get(0)));
        }
        Set<UUID> followers = new LinkedHashSet<>(request.getFollowerIds() == null ? List.of() : request.getFollowerIds());
        followers.remove(null);
        requireInOrganization(graph, followers, orgId);

        boolean active = request.getActive() == null ? (p.getId() == null || p.isActive()) : request.getActive();
        if (active) requireNoOverlap(p.getId(), orgId, objectType, subObjects);

        p.setTitle(request.getTitle().trim());
        p.setObjectType(objectType);
        p.setSubObjectTypes(new ArrayList<>(subObjects));
        p.setShowInObject(request.isShowInObject());
        p.setActive(active);
        p.setDefinition(codec.write(graph));
        p.getFollowerIds().clear();
        p.getFollowerIds().addAll(followers);
        p.setUpdatedBy(actor);
    }

    /**
     * Quy trình đơn từ phải chọn ít nhất một đơn của chính tổ chức: không có lựa chọn "Tất cả" — một quy
     * trình chung sẽ lặng lẽ thay sơ đồ riêng của mọi đơn.
     */
    private List<String> normalizeForms(UUID orgId, List<String> raw) {
        List<String> out = new ArrayList<>();
        for (String id : raw == null ? List.<String>of() : raw) {
            if (id == null || id.isBlank() || out.contains(id)) continue;
            UUID formId;
            try {
                formId = UUID.fromString(id);
            } catch (IllegalArgumentException e) {
                throw new BusinessException(ErrorCode.APPROVAL_PROCESS_BAD_SUB_OBJECT);
            }
            if (formRepository.findByIdAndOrganizationId(formId, orgId).isEmpty()) {
                throw new BusinessException(ErrorCode.APPROVAL_PROCESS_BAD_SUB_OBJECT);
            }
            out.add(id);
        }
        if (out.isEmpty()) throw new BusinessException(ErrorCode.APPROVAL_PROCESS_FORM_REQUIRED);
        return out;
    }

    private List<String> normalizeSubObjects(ApprovalObjectType objectType, List<String> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null) return out;
        for (String code : raw) {
            if (code == null || code.isBlank() || out.contains(code)) continue;
            if (!objectType.subObjects().contains(code)) {
                throw new BusinessException(ErrorCode.APPROVAL_PROCESS_BAD_SUB_OBJECT);
            }
            out.add(code);
        }
        return out;
    }

    /** Cắt khoảng trắng tên node, đóng dấu phiên bản sơ đồ — dùng chung với đơn từ. */
    public static ProcessGraph normalize(ProcessGraph g) {
        if (g == null) return new ProcessGraph(ProcessGraph.SCHEMA_VERSION, List.of(), List.of());
        List<Node> nodes = g.nodesOrEmpty().stream()
                .map(n -> n == null ? null : new Node(n.id(), n.type(), n.x(), n.y(),
                        n.name() == null ? null : n.name().trim(), n.groups(), n.approvers()))
                .toList();
        return new ProcessGraph(ProcessGraph.SCHEMA_VERSION, nodes, g.edgesOrEmpty());
    }

    /**
     * Trong một tổ chức và một đối tượng, các quy trình đang bật không được chung đối tượng con, và
     * chỉ một quy trình được để "Tất cả" — để mỗi lần gửi duyệt chỉ có đúng một quy trình khớp.
     */
    private void requireNoOverlap(UUID selfId, UUID orgId, ApprovalObjectType objectType, List<String> subObjects) {
        for (ApprovalProcess other : repository.findByOrganizationIdAndObjectTypeAndActiveTrue(orgId, objectType)) {
            if (other.getId().equals(selfId)) continue;
            List<String> theirs = other.subObjectsOrEmpty();
            boolean overlap = subObjects.isEmpty()
                    ? theirs.isEmpty()
                    : subObjects.stream().anyMatch(theirs::contains);
            if (overlap) throw new BusinessException(ErrorCode.APPROVAL_PROCESS_OVERLAP, other.getTitle());
        }
    }

    /** Người / chức vụ / đơn vị nhắc trong sơ đồ (và người theo dõi) phải thuộc tổ chức — dùng chung với đơn từ. */
    public void requireInOrganization(ProcessGraph graph, Set<UUID> followers, UUID orgId) {
        Set<UUID> users = new HashSet<>(followers);
        Set<UUID> roles = new HashSet<>();
        Set<UUID> units = new HashSet<>();
        for (Node n : graph.nodesOrEmpty()) {
            for (ApproverSpec a : n.approversOrEmpty()) {
                if (a == null || a.type() == null) continue;
                switch (a.type()) {
                    case USER -> users.add(a.userId());
                    case ROLE -> roles.add(a.roleId());
                    case ORG_UNIT_HEAD -> units.add(a.orgUnitId());
                    case REQUESTER_MANAGER -> { }
                }
            }
        }
        users.remove(null);
        roles.remove(null);
        units.remove(null);
        for (UUID userId : users) {
            if (!permissionChecker.isMemberOfOrganization(userId, orgId)) outside();
        }
        if (!roles.isEmpty()) {
            List<Role> found = roleRepository.findAllById(roles);
            if (found.size() != roles.size() || found.stream().anyMatch(r -> r.getDeletedAt() != null
                    || r.getOrganization() == null || !orgId.equals(r.getOrganization().getId()))) outside();
        }
        if (!units.isEmpty()) {
            List<OrgUnit> found = orgUnitRepository.findAllById(units);
            if (found.size() != units.size() || found.stream()
                    .anyMatch(u -> !orgId.equals(PermissionChecker.organizationIdOf(u)))) outside();
        }
    }

    private static void outside() {
        throw new BusinessException(ErrorCode.APPROVAL_PROCESS_REFERENCE_OUTSIDE_ORGANIZATION);
    }

    // ── Tiện ích ────────────────────────────────────────────────────────────

    private UUID organizationId() {
        UUID orgId = workflowConfigService.currentOrganizationId();
        if (orgId == null) throw new BusinessException(ErrorCode.APPROVAL_PROCESS_NO_ORGANIZATION);
        return orgId;
    }

    private ApprovalProcess load(UUID id, UUID orgId) {
        return repository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.approvalProcess"), "id", id));
    }

    private boolean canManage() {
        return permissionChecker.hasPermission(workflowConfigService.currentUser().getId(), PERM_MANAGE);
    }

    private Map<UUID, User> usersById(Collection<UUID> ids) {
        Map<UUID, User> out = new HashMap<>();
        if (ids == null || ids.isEmpty()) return out;
        for (User u : userRepository.findAllById(ids)) out.put(u.getId(), u);
        return out;
    }

    /** Người được nhắc tới trong sơ đồ: người duyệt cụ thể, giá trị của điều kiện "người gửi". */
    public static Set<UUID> referencedUsers(ProcessGraph g) {
        Set<UUID> out = new HashSet<>();
        for (Node n : g.nodesOrEmpty()) {
            for (ApproverSpec a : n.approversOrEmpty()) {
                if (a != null && a.type() == ApproverType.USER && a.userId() != null) out.add(a.userId());
            }
            for (ConditionGroup group : n.groupsOrEmpty()) {
                for (ConditionRule r : group.rulesOrEmpty()) {
                    if (r.field() != ConditionField.REQUESTER) continue;
                    for (String v : r.valuesOrEmpty()) {
                        UUID id = ProcessGraphValidator.parseUuid(v);
                        if (id != null) out.add(id);
                    }
                }
            }
        }
        return out;
    }

    private ApprovalProcessResponse toResponse(ApprovalProcess p, Map<UUID, User> users, boolean canManage,
                                               boolean withDefinition) {
        Optional<ProcessGraph> graph = codec.tryRead(p.getDefinition());
        Map<UUID, ApprovalProcessResponse.Person> refs = new LinkedHashMap<>();
        if (withDefinition) {
            graph.ifPresent(g -> referencedUsers(g).forEach(id -> {
                User u = users.get(id);
                if (u != null) refs.put(id, person(u));
            }));
        }
        return ApprovalProcessResponse.builder()
                .id(p.getId())
                .title(p.getTitle())
                .objectType(p.getObjectType())
                .subObjectTypes(p.subObjectsOrEmpty())
                .approvalType(p.getApprovalType())
                .showInObject(p.isShowInObject())
                .active(p.isActive())
                .definition(withDefinition ? graph.orElse(null) : null)
                .stepCount(graph.map(ProcessGraph::stepCount).orElse(0L))
                .createdBy(p.getCreatedBy() == null ? null : person(p.getCreatedBy()))
                .followers(p.getFollowerIds().stream().map(users::get).filter(Objects::nonNull).map(this::person).toList())
                .refUsers(withDefinition ? refs : null)
                .version(p.getVersion())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .canManage(canManage)
                .build();
    }

    private ApprovalProcessResponse.Person person(User u) {
        return ApprovalProcessResponse.Person.builder()
                .id(u.getId()).name(u.getFullName()).avatarUrl(u.getAvatarUrl()).build();
    }

    private ProcessValidationResponse.Issue toIssue(ProcessGraphValidator.Issue i) {
        return ProcessValidationResponse.Issue.builder()
                .nodeId(i.nodeId())
                .edgeId(i.edgeId())
                .code(i.key())
                .message(render(i))
                .build();
    }

    private static String render(ProcessGraphValidator.Issue i) {
        return ErrorMessages.text(i.key(), i.key(), i.args().toArray());
    }
}
