package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.task.*;


import com.kpitracking.event.TaskEvents;
import com.kpitracking.event.TaskListEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.Terms;

import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.CloudinaryStorageService;
import com.kpitracking.service.discussion.AttachmentLibrarySources;
import com.kpitracking.service.discussion.CollabAttachmentPolicy;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.kpitracking.entity.access.Scope;
import com.kpitracking.entity.kpi.KpiCriteria;
import com.kpitracking.entity.kpi.KpiPeriod;
import com.kpitracking.entity.task.KpiTask;
import com.kpitracking.entity.task.KpiTaskAssignee;
import com.kpitracking.entity.task.KpiTaskAttachment;
import com.kpitracking.entity.task.KpiTaskChecklistItem;
import com.kpitracking.entity.task.KpiTaskEvent;
import com.kpitracking.entity.task.KpiTaskFollower;
import com.kpitracking.entity.task.TaskDependency;
import com.kpitracking.entity.task.TaskFieldValue;
import com.kpitracking.entity.task.TaskList;
import com.kpitracking.entity.task.TaskListField;
import com.kpitracking.entity.task.TaskListItem;
import com.kpitracking.entity.task.TaskListUserPref;
import com.kpitracking.entity.task.TaskRecurrence;
import com.kpitracking.entity.task.TaskSourceRef;
import com.kpitracking.entity.task.TaskTag;
import com.kpitracking.entity.task.TaskTagLink;
import com.kpitracking.entity.user.User;
import com.kpitracking.entity.user.UserRoleOrgUnit;
import com.kpitracking.enums.StorageProvider;
import com.kpitracking.enums.kpi.KpiStatus;
import com.kpitracking.enums.task.KpiTaskEventAction;
import com.kpitracking.enums.task.KpiTaskPriority;
import com.kpitracking.enums.task.KpiTaskStatus;
import com.kpitracking.enums.task.KpiTaskVisibility;
import com.kpitracking.enums.task.TaskCompletionMode;
import com.kpitracking.enums.task.TaskFieldType;
import com.kpitracking.enums.task.TaskListRole;
import com.kpitracking.repository.kpi.KpiCriteriaRepository;
import com.kpitracking.repository.task.KpiTaskAssigneeRepository;
import com.kpitracking.repository.task.KpiTaskAttachmentRepository;
import com.kpitracking.repository.task.KpiTaskChecklistItemRepository;
import com.kpitracking.repository.task.KpiTaskEventRepository;
import com.kpitracking.repository.task.KpiTaskFollowerRepository;
import com.kpitracking.repository.task.KpiTaskReminderRepository;
import com.kpitracking.repository.task.KpiTaskRepository;
import com.kpitracking.repository.task.TaskDependencyRepository;
import com.kpitracking.repository.task.TaskFieldValueRepository;
import com.kpitracking.repository.task.TaskListFieldRepository;
import com.kpitracking.repository.task.TaskListItemRepository;
import com.kpitracking.repository.task.TaskListRepository;
import com.kpitracking.repository.task.TaskListSectionRepository;
import com.kpitracking.repository.task.TaskListUserPrefRepository;
import com.kpitracking.repository.task.TaskTagLinkRepository;
import com.kpitracking.repository.task.TaskTagRepository;
import com.kpitracking.repository.user.UserRepository;
import com.kpitracking.repository.user.UserRoleOrgUnitRepository;
/**
 * Công việc kiểu Lark (docs/TASKS_DESIGN.md): KPI TUỲ CHỌN, nhiều người thực hiện, việc con nhiều cấp, lặp lại, hạn có
 * giờ, ngày bắt đầu, nhắc theo việc, mô tả có định dạng, danh sách, nhãn, phụ thuộc. Chỉ để theo dõi — không đổi kết quả KPI.
 *
 * <p>Việc CÓ KPI giữ nguyên luật cũ: mọi người thực hiện là người tạo / thực hiện của KPI, KPI ở trạng thái nhận việc
 * ({@link #TASKABLE}), kỳ đã khoá ⇒ mọi thao tác ghi bị chặn; KPI đã xoá ⇒ chỉ chuyển KPI hoặc xoá. Ba trạng thái KPI chỉ
 * đọc qua {@link TaskKpiLinks}; quyền qua {@link KpiTaskAccess}. Sửa có {@code version}.
 */
@Service
@RequiredArgsConstructor
public class KpiTaskService {

    /** Trạng thái KPI cho phép tạo / chuyển task tới. */
    public static final Set<KpiStatus> TASKABLE = EnumSet.of(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL,
            KpiStatus.EDIT, KpiStatus.EDITED, KpiStatus.APPROVED, KpiStatus.REJECTED);
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    /** {@code new_value} của dòng lịch sử FOLLOWER_REMOVED khi bị gỡ tự động do đổi KPI — gỡ tay thì null. */
    public static final String FOLLOWER_REMOVED_KPI_CHANGED = "KPI_CHANGED";
    /** Độ sâu tối đa của việc con: 0 = gốc … 4 ⇒ 5 cấp. */
    public static final int MAX_DEPTH = 4;
    public static final int MAX_ASSIGNEES = 20;
    private static final int MAX_PAGE = 500;
    private static final int MAX_DESCRIPTION_DOC = 200_000;
    private static final List<KpiTaskStatus> ALL_STATUSES = List.of(KpiTaskStatus.values());

    private final KpiTaskRepository taskRepository;
    private final KpiTaskChecklistItemRepository checklistRepository;
    private final KpiTaskAttachmentRepository attachmentRepository;
    private final KpiTaskEventRepository eventRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final KpiTaskReminderRepository reminderRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final TaskListRepository listRepository;
    private final TaskListUserPrefRepository listPrefRepository;
    private final TaskListItemRepository listItemRepository;
    private final TaskListSectionRepository sectionRepository;
    private final TaskListFieldRepository fieldRepository;
    private final TaskFieldValueRepository fieldValueRepository;
    private final TaskTagRepository tagRepository;
    private final TaskTagLinkRepository tagLinkRepository;
    private final TaskDependencyRepository dependencyRepository;
    private final KpiTaskAccess access;
    private final TaskListAccess listAccess;
    private final TaskKpiLinks kpiLinks;
    private final TaskSearch search;
    private final TaskResponseAssembler assembler;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final PermissionChecker permissionChecker;
    private final CycleStatusGuard cycleStatusGuard;
    private final CollabAttachmentPolicy attachmentPolicy;
    private final AttachmentLibrarySources librarySources;
    private final CloudinaryStorageService storage;
    private final KpiTaskReminderPlanner reminderPlanner;
    private final ApplicationEventPublisher events;

    /** Cờ bật / tắt nhiều người thực hiện (docs/TASKS_DESIGN.md §3). */
    @Value("${app.tasks.multi-assignee:true}")
    private boolean multiAssignee = true;

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Ngày làm việc cuối tuần (nhóm "Tuần này" khi kéo thả dùng phía giao diện; ở đây chỉ để phân nhóm hạn). */
    public static LocalDate endOfWeek(LocalDate d) {
        return d.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
    }

    public boolean multiAssigneeEnabled() {
        return multiAssignee;
    }

    // ══ Đọc ══════════════════════════════════════════════════════════════════════════════════════

    /** Tham số danh sách: chế độ xem + bộ lọc + sắp xếp. */
    public record ListQuery(String view, UUID kpiId, UUID periodId, UUID ownerId, List<KpiTaskStatus> statuses,
                            KpiTaskPriority priority, String due, LocalDate dueFrom, LocalDate dueTo, String keyword,
                            String sort, boolean topLevel, int page, int size,
                            UUID listId, UUID sectionId, boolean noSection, Boolean hasKpi, List<UUID> tagIds,
                            List<TaskSearch.FieldFilter> fieldFilters, UUID sortFieldId, LocalDate rangeFrom, LocalDate rangeTo) {

        /** Bản rút gọn (tương thích code cũ / test). */
        public ListQuery(String view, UUID kpiId, UUID periodId, UUID ownerId, List<KpiTaskStatus> statuses,
                         KpiTaskPriority priority, String due, LocalDate dueFrom, LocalDate dueTo, String keyword,
                         String sort, boolean topLevel, int page, int size) {
            this(view, kpiId, periodId, ownerId, statuses, priority, due, dueFrom, dueTo, keyword, sort, topLevel, page, size,
                    null, null, false, null, null, null, null, null, null);
        }
    }

    /**
     * Danh sách theo chế độ xem (cột trái): ASSIGNED, FOLLOWING, CREATED, DELEGATED, ALL, DONE, TEAM, LIST (cần listId),
     * SEARCH (mọi việc mình xem được). {@code due}: OVERDUE | TODAY | TOMORROW | WEEK | LATER | NONE.
     */
    @Transactional(readOnly = true)
    public PageResponse<KpiTaskResponse> list(ListQuery q) {
        User me = currentUser();
        requireOwnPermission(me);
        String view = q.view() == null ? "ASSIGNED" : q.view().toUpperCase(Locale.ROOT);
        List<KpiTaskStatus> statuses = q.statuses() == null || q.statuses().isEmpty() ? ALL_STATUSES : q.statuses();
        if ("DONE".equals(view)) {
            statuses = List.of(KpiTaskStatus.DONE);
            view = "INVOLVED";
        } else if ("ALL".equals(view)) {
            view = "INVOLVED";
        }
        if (!TaskSearch.VIEWS.contains(view)) view = "ASSIGNED";
        if ("TEAM".equals(view) && !permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM)) {
            throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        TaskFieldType sortType = null;
        List<TaskSearch.FieldFilter> filters = List.of();
        if ("LIST".equals(view)) {
            if (q.listId() == null) throw new BusinessException(ErrorCode.TASK_LIST_NOT_FOUND);
            TaskList list = listRepository.findById(q.listId()).orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_NOT_FOUND));
            listAccess.require(me.getId(), list, TaskListRole.VIEWER);
            // Trường tuỳ chỉnh chỉ nhóm / lọc / sắp xếp được trong MỘT danh sách — trường lạ bị bỏ qua.
            Map<UUID, TaskListField> fields = fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(list.getId()).stream()
                    .collect(Collectors.toMap(TaskListField::getId, Function.identity()));
            if (q.sortFieldId() != null && fields.containsKey(q.sortFieldId())) sortType = fields.get(q.sortFieldId()).getType();
            if (q.fieldFilters() != null) {
                filters = q.fieldFilters().stream().filter(f -> f.fieldId() != null && fields.containsKey(f.fieldId()))
                        .map(f -> new TaskSearch.FieldFilter(f.fieldId(), fields.get(f.fieldId()).getType(), f.op(), f.value()))
                        .toList();
            }
        }
        return page(me, view, false, statuses, q, sortType, filters);
    }

    /** Tab "Công việc" trong chi tiết KPI: việc cấp cao nhất trên KPI mà tôi thấy được. */
    @Transactional(readOnly = true)
    public List<KpiTaskResponse> tasksOfKpi(UUID kpiId) {
        User me = currentUser();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", kpiId));
        kpiAccessPolicy.assertCanView(me.getId(), kpi);
        boolean team = access.canViewTeamTasksOf(me.getId(), kpi);
        ListQuery q = new ListQuery("KPI", kpiId, null, null, null, null, null, null, null, null, "manual", true, 0, MAX_PAGE);
        return page(me, "KPI", team, ALL_STATUSES, q, null, List.of()).getContent();
    }

    private PageResponse<KpiTaskResponse> page(User me, String view, boolean kpiTeam, List<KpiTaskStatus> statuses, ListQuery q,
                                               TaskFieldType sortFieldType, List<TaskSearch.FieldFilter> fieldFilters) {
        LocalDate today = today();
        LocalDate from = q.dueFrom(), to = q.dueTo();
        boolean noDue = false, overdue = false;
        if (q.due() != null) {
            switch (q.due().toUpperCase(Locale.ROOT)) {
                case "OVERDUE" -> overdue = true;
                case "TODAY" -> { from = today; to = today; }
                case "TOMORROW" -> { from = today.plusDays(1); to = from; }
                case "WEEK" -> { from = today; to = endOfWeek(today); }
                case "LATER" -> from = endOfWeek(today).plusDays(1);
                case "NONE" -> noDue = true;
                default -> { }
            }
        }
        UUID orgId = organizationOf(me);
        boolean needsScope = "TEAM".equals(view) || "LIST".equals(view) || "SEARCH".equals(view);
        KpiAccessPolicy.Viewer viewer = needsScope ? kpiAccessPolicy.viewer(me.getId(), orgId) : null;
        boolean viewTeam = needsScope && permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM);
        Collection<UUID> myLists = "LIST".equals(view) || "SEARCH".equals(view) ? listAccess.rolesOf(me.getId()).keySet() : List.of();
        int size = Math.min(Math.max(q.size(), 1), MAX_PAGE);
        TaskSearch.Result result = search.search(new TaskSearch.Criteria(
                view, me.getId(), orgId,
                q.listId(), q.sectionId(), q.noSection(),
                q.kpiId(), q.hasKpi(), q.periodId(), q.ownerId(),
                statuses, q.priority(),
                noDue, from, to, overdue,
                q.rangeFrom(), q.rangeTo(),
                q.keyword(), q.tagIds(), fieldFilters,
                q.sort(), sortFieldType != null ? q.sortFieldId() : null, sortFieldType, q.topLevel(),
                myLists, viewTeam, viewer != null ? viewer.managerUnitPaths() : List.of(), viewer != null && viewer.admin(), kpiTeam,
                today, LocalTime.now(ZONE).withNano(0), q.page(), size));
        Map<UUID, KpiTask> byId = taskRepository.findAllById(result.ids()).stream()
                .collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        List<KpiTask> content = result.ids().stream().map(byId::get).filter(Objects::nonNull).toList();
        int pages = (int) Math.ceil(result.total() / (double) size);
        return PageResponse.<KpiTaskResponse>builder()
                .content(assembler.toResponses(me, content, false))
                .page(Math.max(q.page(), 0))
                .size(size)
                .totalElements(result.total())
                .totalPages(pages)
                .last(q.page() + 1 >= pages)
                .build();
    }

    @Transactional(readOnly = true)
    public KpiTaskResponse get(UUID taskId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        return assembler.detail(me, task);
    }

    @Transactional(readOnly = true)
    public List<KpiTaskEventResponse> history(UUID taskId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        List<KpiTaskEvent> list = eventRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
        Set<UUID> userIds = new HashSet<>();
        list.forEach(e -> {
            if (e.getActorId() != null) userIds.add(e.getActorId());
            addIfUuid(userIds, e.getOldValue());
            addIfUuid(userIds, e.getNewValue());
        });
        Map<UUID, String> names = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));
        return list.stream().map(e -> {
            KpiTaskEventResponse r = KpiTaskEventResponse.builder().id(e.getId()).action(e.getAction())
                    .oldValue(nameOr(names, e.getOldValue())).newValue(nameOr(names, e.getNewValue()))
                    .actorId(e.getActorId()).actorName(names.get(e.getActorId())).createdAt(e.getCreatedAt()).build();
            return r;
        }).toList();
    }

    /**
     * Tiến độ việc (cấp cao nhất) trên từng KPI cho người xem (danh sách KPI): việc mình liên quan, cộng việc công khai
     * của người khác khi có {@code TASK:VIEW_TEAM} — người gọi đã chỉ đưa vào các KPI người xem thấy được.
     */
    @Transactional(readOnly = true)
    public Map<UUID, long[]> progress(UUID viewerId, Collection<UUID> kpiIds) {
        if (kpiIds == null || kpiIds.isEmpty()) return Map.of();
        boolean team = permissionChecker.hasPermission(viewerId, KpiTaskAccess.VIEW_TEAM);
        Map<UUID, long[]> out = new HashMap<>();
        for (Object[] r : taskRepository.progressFor(kpiIds, viewerId, team, today())) {
            out.put(uuid(r[0]), new long[]{num(r[1]), num(r[2]), num(r[3])});
        }
        return out;
    }

    /** Các KPI cũ đã được thay bằng {@code newKpiId} mà người gọi còn việc chưa xong. */
    @Transactional(readOnly = true)
    public List<TaskReplacementResponse> replacementCandidates(UUID newKpiId) {
        User me = currentUser();
        KpiCriteria newKpi = kpiCriteriaRepository.findById(newKpiId)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.kpi"), "id", newKpiId));
        List<TaskReplacementResponse> out = new ArrayList<>();
        for (KpiCriteria old : kpiCriteriaRepository.findByReplacedById(newKpiId)) {
            int open = (int) taskRepository.findOpenByOwnerAndKpi(me.getId(), old.getId()).stream().filter(KpiTask::isRoot).count();
            if (open > 0) {
                out.add(TaskReplacementResponse.builder().oldKpiId(old.getId()).oldKpiName(old.getName())
                        .newKpiId(newKpiId).newKpiName(newKpi.getName()).openTaskCount(open).build());
            }
        }
        return out;
    }

    /** Cột trái: số việc chưa xong theo chế độ xem, danh sách của tôi, KPI của đợt đang diễn ra, huy hiệu. */
    @Transactional(readOnly = true)
    public TaskSidebarResponse sidebar() {
        User me = currentUser();
        Object[] c = taskRepository.viewCounts(me.getId()).stream().findFirst().orElse(new Object[]{0, 0, 0, 0, 0});
        List<TaskSidebarResponse.KpiCount> kpis = taskRepository.myCurrentKpis(me.getId(), Instant.now()).stream()
                .map(r -> TaskSidebarResponse.KpiCount.builder().kpiId(uuid(r[0])).kpiName((String) r[1]).open(num(r[2])).build())
                .toList();
        Map<UUID, TaskListRole> roles = listAccess.rolesOf(me.getId());
        Map<UUID, Long> openByList = new HashMap<>();
        if (!roles.isEmpty()) {
            for (Object[] r : listRepository.openCounts(roles.keySet(), me.getId())) openByList.put(uuid(r[0]), num(r[1]));
        }
        Map<UUID, TaskListUserPref> prefs = roles.isEmpty() ? Map.of() : listPrefRepository.findByUserId(me.getId()).stream()
                .collect(Collectors.toMap(TaskListUserPref::getListId, Function.identity()));
        List<TaskSidebarResponse.ListCount> lists = roles.isEmpty() ? List.of() : listRepository.findAllById(roles.keySet()).stream()
                .sorted(Comparator.comparing((TaskList l) -> l.getArchivedAt() != null)
                        .thenComparing((TaskList l) -> !(prefs.containsKey(l.getId()) && prefs.get(l.getId()).isPinned()))
                        .thenComparing(TaskList::getName, String.CASE_INSENSITIVE_ORDER))
                .map(l -> {
                    TaskListUserPref p = prefs.get(l.getId());
                    return TaskSidebarResponse.ListCount.builder().listId(l.getId()).name(l.getName()).color(l.getColor()).icon(l.getIcon())
                            .role(roles.get(l.getId()).name()).archived(l.getArchivedAt() != null)
                            .open(openByList.getOrDefault(l.getId(), 0L))
                            .pinned(p != null && p.isPinned()).folder(p != null ? p.getFolder() : null).build();
                })
                .toList();
        return TaskSidebarResponse.builder()
                .assigned(num(c[0])).following(num(c[1])).created(num(c[2])).delegated(num(c[3])).all(num(c[4]))
                .noKpi(taskRepository.countMyOpenWithoutKpi(me.getId()))
                .canViewTeam(permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM))
                .canAssign(permissionChecker.hasPermission(me.getId(), KpiTaskAccess.ASSIGN))
                .multiAssignee(multiAssignee)
                .badge(taskRepository.badgeCount(me.getId(), today()))
                .kpis(kpis)
                .lists(lists)
                .build();
    }

    @Transactional(readOnly = true)
    public long badge() {
        return taskRepository.badgeCount(currentUser().getId(), today());
    }

    /**
     * Ô chọn người thực hiện. {@code all = false}: chính mình + (có TASK:ASSIGN) người trong đơn vị mình quản lý — giao trên
     * KPI. {@code all = true}: mọi người trong tổ chức — giao việc KHÔNG KPI (giao chéo phòng ban).
     */
    @Transactional(readOnly = true)
    public List<TaskOptionResponse> assignableUsers(String query, boolean all) {
        User me = currentUser();
        UUID orgId = organizationOf(me);
        List<UUID> ids = new ArrayList<>();
        ids.add(me.getId());
        if (all && orgId != null) {
            taskRepository.orgMembers(orgId, blankToNull(query), 300).forEach(r -> { if (!ids.contains(uuid(r[0]))) ids.add(uuid(r[0])); });
        } else if (permissionChecker.hasPermission(me.getId(), KpiTaskAccess.ASSIGN)) {
            boolean admin = orgId != null && permissionChecker.isGlobalAdminOfOrganization(me.getId(), orgId);
            taskRepository.assignableUsers(me.getId(), admin, orgId != null ? orgId : new UUID(0, 0), blankToNull(query), 300)
                    .forEach(r -> { if (!ids.contains(uuid(r[0]))) ids.add(uuid(r[0])); });
        }
        return people(ids, query);
    }

    /** Ô chọn KPI khi giao cho {@code ownerId}: KPI còn nhận việc của người đó mà tôi được giao việc trên. */
    @Transactional(readOnly = true)
    public List<TaskOptionResponse> assignableKpis(UUID ownerId) {
        User me = currentUser();
        UUID owner = ownerId != null ? ownerId : me.getId();
        List<KpiCriteria> kpis = kpiCriteriaRepository.findAllById(taskRepository.taskableKpiIdsOf(owner));
        Instant now = Instant.now();
        return kpis.stream()
                .filter(k -> access.canAssign(me.getId(), owner, k) && !TaskResponseAssembler.isLocked(k))
                .sorted(Comparator.comparing((KpiCriteria k) -> k.getKpiPeriod() != null && k.getKpiPeriod().getStartDate() != null
                        ? k.getKpiPeriod().getStartDate() : Instant.EPOCH).reversed().thenComparing(KpiCriteria::getName))
                .map(k -> {
                    KpiPeriod p = k.getKpiPeriod();
                    boolean current = p != null && p.getStartDate() != null && p.getEndDate() != null
                            && !now.isBefore(p.getStartDate()) && !now.isAfter(p.getEndDate());
                    return TaskOptionResponse.builder().id(k.getId()).name(k.getName())
                            .secondary(p != null ? p.getName() : null)
                            .detail(k.getStatus().name())
                            .groupId(p != null ? p.getId() : null)
                            .groupName(p != null ? p.getName() : null)
                            .groupCurrent(current)
                            .groupSort(p != null && p.getStartDate() != null ? p.getStartDate().toString() : "")
                            .build();
                })
                .toList();
    }

    /** Ô thêm người theo dõi: việc có KPI ⇒ người xem được KPI; việc không KPI ⇒ người cùng tổ chức. */
    @Transactional(readOnly = true)
    public List<TaskOptionResponse> followerCandidates(UUID taskId, String query) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        TaskKpiLinks.Link link = kpiLinks.of(task);
        List<UUID> ids = link.none()
                ? taskRepository.orgMembers(task.getOrganizationId(), blankToNull(query), 30).stream().map(r -> uuid(r[0])).toList()
                : link.active() ? kpiAccessPolicy.viewerIds(link.kpiId(), KpiTaskAccess.VIEW_OWN, blankToNull(query), 30) : List.of();
        Set<UUID> existing = new HashSet<>(followerRepository.findUserIds(taskId));
        existing.addAll(assigneeRepository.findUserIds(taskId));
        return people(ids.stream().filter(id -> !existing.contains(id)).toList(), null);
    }

    // ══ Tạo ══════════════════════════════════════════════════════════════════════════════════════

    @Transactional
    public KpiTaskResponse create(CreateKpiTaskRequest req) {
        User me = currentUser();
        KpiTask task = createInternal(me, req);
        return assembler.detail(me, task);
    }

    /** Tạo một việc (dùng chung cho API, nhân bản, mẫu danh sách, nhập Excel, K.AI). */
    KpiTask createInternal(User me, CreateKpiTaskRequest req) {
        requireOwnPermission(me);
        String title = requireTitle(req.getTitle());
        KpiTask parent = null;
        TaskKpiLinks.Link link;
        UUID orgId;
        if (req.getParentTaskId() != null) {
            parent = editable(me, req.getParentTaskId(), null, false);
            int depth = (parent.getDepth() == null ? 0 : parent.getDepth()) + 1;
            if (depth > MAX_DEPTH) throw new BusinessException(ErrorCode.TASK_SUBTASK_TOO_DEEP, MAX_DEPTH + 1);
            link = kpiLinks.of(parent);
            orgId = parent.getOrganizationId();
        } else if (req.getKpiId() != null) {
            KpiCriteria kpi = kpiCriteriaRepository.findById(req.getKpiId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.TASK_KPI_REQUIRED));
            link = new TaskKpiLinks.Link(TaskKpiLinks.State.ACTIVE, kpi.getId(), kpi);
            orgId = KpiAccessPolicy.organizationIdOf(kpi);
        } else {
            link = TaskKpiLinks.Link.NONE;
            orgId = null;
        }

        TaskList list = null;
        if (req.getListId() != null && parent == null) {
            list = listRepository.findById(req.getListId()).orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_NOT_FOUND));
            listAccess.require(me.getId(), list, TaskListRole.EDITOR);
            if (list.getArchivedAt() != null) throw new BusinessException(ErrorCode.TASK_LIST_ARCHIVED);
            if (orgId == null) orgId = list.getOrganizationId();
            if (!orgId.equals(list.getOrganizationId())) throw new BusinessException(ErrorCode.TASK_LIST_ORG_MISMATCH);
        }
        if (orgId == null) orgId = organizationOf(me);
        if (orgId == null) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);

        List<UUID> assigneeIds = new ArrayList<>(new LinkedHashSet<>(
                req.getAssigneeIds() != null && !req.getAssigneeIds().isEmpty() ? req.getAssigneeIds().stream().filter(Objects::nonNull).toList()
                        : List.of(req.getOwnerId() != null ? req.getOwnerId() : me.getId())));
        List<User> assignees = validateAssignees(me, link, orgId, assigneeIds, parent != null);
        if (link.active()) {
            if (!TASKABLE.contains(link.kpi().getStatus())) {
                throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, link.kpi().getStatus().name());
            }
            cycleStatusGuard.assertWritable(link.kpi());
        }
        validateRecurrence(req.getRecurrence(), req.getDueDate());
        checkDescriptionDoc(req.getDescriptionDoc());
        checkStartBeforeDue(req.getStartDate(), req.getDueDate());

        User owner = assignees.get(0);
        UUID[] ancestors = parent == null ? new UUID[0] : append(parent.getAncestorIds(), parent.getId());
        KpiTask task = taskRepository.save(KpiTask.builder()
                .organizationId(orgId)
                .kpiCriteriaId(link.kpiId())
                .parentTaskId(parent != null ? parent.getId() : null)
                .rootTaskId(parent != null ? parent.rootId() : null)
                .ancestorIds(ancestors)
                .depth((short) ancestors.length)
                .title(title)
                .description(blankToNull(req.getDescription()))
                .descriptionDoc(blankToNull(req.getDescriptionDoc()))
                .startDate(req.getStartDate())
                .startTime(req.getStartDate() != null ? req.getStartTime() : null)
                .dueDate(req.getDueDate())
                .dueTime(req.getDueDate() != null ? req.getDueTime() : null)
                .priority(req.getPriority() != null ? req.getPriority() : KpiTaskPriority.MEDIUM)
                .visibility(parent != null ? parent.getVisibility()
                        : req.getVisibility() != null ? req.getVisibility() : KpiTaskVisibility.KPI_SCOPE)
                .completionMode(req.getCompletionMode() != null ? req.getCompletionMode() : TaskCompletionMode.ANY)
                .status(KpiTaskStatus.TODO)
                .owner(owner)
                .createdBy(me.getId())
                .sortOrder(taskRepository.maxSortOrder(owner.getId(), KpiTaskStatus.TODO) + 1)
                .recurrence(copyRule(req.getRecurrence()))
                .recurrenceEndDate(req.getRecurrence() != null ? req.getRecurrenceEndDate() : null)
                .sourceRef(sanitizeSource(req.getSourceRef()))
                .build());
        if (task.getRecurrence() != null) {
            task.setSeriesId(task.getId());
            task.setSeriesIndex(1);
            // Ghi ngay để version trong phản hồi khớp DB (lần sửa kế tiếp của client mang đúng version).
            task = taskRepository.saveAndFlush(task);
        }
        for (User a : assignees) {
            assigneeRepository.save(KpiTaskAssignee.builder().taskId(task.getId()).userId(a.getId()).addedBy(me.getId()).build());
        }
        if (req.getChecklist() != null) {
            int i = 0;
            for (String step : req.getChecklist()) {
                if (step == null || step.isBlank()) continue;
                checklistRepository.save(KpiTaskChecklistItem.builder().taskId(task.getId())
                        .title(truncate(step.strip(), 500)).sortOrder(i++).build());
            }
        }
        Set<UUID> assigneeSet = assignees.stream().map(User::getId).collect(Collectors.toSet());
        List<UUID> addedFollowers = new ArrayList<>();
        if (req.getFollowerIds() != null) {
            for (UUID f : new LinkedHashSet<>(req.getFollowerIds())) {
                if (f == null || assigneeSet.contains(f)) continue;
                assertFollowerAllowed(f, link, orgId);
                followerRepository.save(KpiTaskFollower.builder().taskId(task.getId()).userId(f).addedBy(me.getId()).build());
                addedFollowers.add(f);
            }
        }
        reminderPlanner.replace(task, req.getReminders());
        if (req.getTagIds() != null && !req.getTagIds().isEmpty()) setTagsInternal(task, req.getTagIds());
        if (list != null) {
            UUID sectionId = req.getSectionId();
            if (sectionId != null && sectionRepository.findById(sectionId).filter(s -> s.getListId().equals(req.getListId())).isEmpty()) {
                throw new BusinessException(ErrorCode.TASK_LIST_SECTION_NOT_FOUND);
            }
            listItemRepository.save(TaskListItem.builder().listId(list.getId()).taskId(task.getId()).sectionId(sectionId)
                    .sortOrder(listItemRepository.maxSortOrder(list.getId()) + 1).addedBy(me.getId()).build());
            log(task, me, KpiTaskEventAction.LIST_ADDED, null, list.getName());
            if (req.getFieldValues() != null) {
                for (Map.Entry<UUID, Object> e : req.getFieldValues().entrySet()) writeFieldValue(me, task, list.getId(), e.getKey(), e.getValue());
            }
        }
        log(task, me, KpiTaskEventAction.CREATED, null, null);
        for (User a : assignees) if (!a.getId().equals(me.getId())) log(task, me, KpiTaskEventAction.ASSIGNED, null, a.getId().toString());
        if (parent != null) log(parent, me, KpiTaskEventAction.SUBTASK_ADDED, null, task.getTitle());

        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.CREATED));
        for (User a : assignees) {
            if (!a.getId().equals(me.getId())) {
                events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, null, a.getId()));
            }
        }
        if (parent != null) events.publishEvent(TaskEvents.Changed.of(parent.getId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        UUID createdId = task.getId();
        addedFollowers.forEach(f -> events.publishEvent(new TaskEvents.Changed(createdId, me.getId(), TaskEvents.Kind.FOLLOWER_ADDED, null, f)));
        if (list != null) events.publishEvent(new TaskListEvents.ItemAdded(list.getId(), task.getId(), me.getId()));
        return task;
    }

    // ══ Sửa ══════════════════════════════════════════════════════════════════════════════════════

    /**
     * Sửa từng trường (tự lưu). Việc lặp: {@code scope = FOLLOWING} áp cho lần này + các lần chưa xong phía sau và đổi
     * "bản mẫu" của chuỗi; {@code THIS} (mặc định) chỉ lần này — bản mẫu giữ giá trị cũ cho các lần sau.
     */
    @Transactional
    public KpiTaskResponse update(UUID taskId, UpdateKpiTaskRequest req) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, req.getVersion(), false);
        boolean following = "FOLLOWING".equalsIgnoreCase(req.getScope());
        checkDescriptionDoc(req.getDescriptionDoc());

        // "Chỉ lần này" trên việc lặp: chụp bản mẫu từ giá trị CŨ trước khi đổi để các lần sau giữ nguyên.
        if (task.getRecurrence() != null && !following && task.getRecurrence().getTemplate() == null && touchesTemplate(req)) {
            TaskRecurrence rule = copyRule(task.getRecurrence());
            rule.setTemplate(templateOf(task));
            task.setRecurrence(rule);
        }

        LocalDate oldDue = task.getDueDate();
        LocalTime oldTime = task.getDueTime();
        KpiTaskVisibility oldVisibility = task.getVisibility();
        applyContent(task, req, me, true);

        // Hạn.
        LocalDate newDue = req.isClearDueDate() ? null : (req.getDueDate() != null ? req.getDueDate() : task.getDueDate());
        LocalTime newTime = newDue == null || req.isClearDueTime() ? null : (req.getDueTime() != null ? req.getDueTime() : task.getDueTime());
        boolean dueChanged = !Objects.equals(newDue, oldDue) || !Objects.equals(newTime, oldTime);
        // Bắt đầu.
        LocalDate newStart = req.isClearStartDate() ? null : (req.getStartDate() != null ? req.getStartDate() : task.getStartDate());
        LocalTime newStartTime = newStart == null || req.isClearStartTime() ? null
                : (req.getStartTime() != null ? req.getStartTime() : task.getStartTime());
        boolean startChanged = !Objects.equals(newStart, task.getStartDate()) || !Objects.equals(newStartTime, task.getStartTime());
        checkStartBeforeDue(newStart, newDue);
        if (dueChanged) {
            if (newDue == null && task.getRecurrence() != null && !req.isClearRecurrence()) {
                throw new BusinessException(ErrorCode.TASK_RECURRENCE_NEEDS_DUE);
            }
            log(task, me, KpiTaskEventAction.DUE_CHANGED, dueText(oldDue, oldTime), dueText(newDue, newTime));
            task.setDueDate(newDue);
            task.setDueTime(newTime);
            task.setRemindedOverdueAt(null);
        }
        if (startChanged) {
            log(task, me, KpiTaskEventAction.START_CHANGED, dueText(task.getStartDate(), task.getStartTime()), dueText(newStart, newStartTime));
            task.setStartDate(newStart);
            task.setStartTime(newStartTime);
        }
        if (req.getCompletionMode() != null && req.getCompletionMode() != task.getCompletionMode()) {
            log(task, me, KpiTaskEventAction.COMPLETION_MODE_CHANGED, task.getCompletionMode().name(), req.getCompletionMode().name());
            task.setCompletionMode(req.getCompletionMode());
        }

        // Lặp lại.
        if (req.isClearRecurrence() && task.getRecurrence() != null) {
            log(task, me, KpiTaskEventAction.RECURRENCE_CHANGED, "ON", "OFF");
            task.setRecurrence(null);
            task.setRecurrenceEndDate(null);
        } else if (req.getRecurrence() != null) {
            validateRecurrence(req.getRecurrence(), task.getDueDate());
            TaskRecurrence rule = copyRule(req.getRecurrence());
            if (task.getRecurrence() != null) rule.setTemplate(task.getRecurrence().getTemplate());
            task.setRecurrence(rule);
            if (task.getSeriesId() == null) {
                task.setSeriesId(task.getId());
                task.setSeriesIndex(1);
            }
            log(task, me, KpiTaskEventAction.RECURRENCE_CHANGED, null, rule.getFreq().name());
        }
        if (req.isClearRecurrenceEndDate()) task.setRecurrenceEndDate(null);
        else if (req.getRecurrenceEndDate() != null) task.setRecurrenceEndDate(req.getRecurrenceEndDate());

        // "Lần này và các lần sau": bản mẫu = giá trị mới; các lần chưa xong phía sau nhận cùng thay đổi.
        if (following && task.getRecurrence() != null) {
            TaskRecurrence rule = copyRule(task.getRecurrence());
            rule.setTemplate(templateOf(task));
            task.setRecurrence(rule);
            if (task.getSeriesId() != null && task.getSeriesIndex() != null) {
                for (KpiTask other : taskRepository.findOpenInSeriesFrom(task.getSeriesId(), task.getSeriesIndex() + 1)) {
                    applyContent(other, req, me, false);
                    other.setRecurrence(copyRule(rule));
                    taskRepository.save(other);
                }
            }
        }

        task = taskRepository.saveAndFlush(task);
        // Phạm vi xem đi theo việc gốc: đổi ở gốc thì cả cây đổi (việc con không có ô phạm vi riêng).
        if (task.isRoot() && task.getVisibility() != oldVisibility) {
            for (KpiTask d : taskRepository.findDescendants(task.getId())) {
                d.setVisibility(task.getVisibility());
                taskRepository.save(d);
            }
        }
        if (dueChanged) reminderPlanner.recompute(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(),
                dueChanged ? TaskEvents.Kind.DUE_CHANGED : TaskEvents.Kind.UPDATED));
        return assembler.detail(me, task);
    }

    /**
     * Hoàn thành / đổi trạng thái. Còn việc con chưa xong ⇒ 409 TASK_PARENT_HAS_OPEN_SUBTASKS; còn bị việc khác chặn ⇒ 409
     * TASK_BLOCKED_BY_OPEN — trừ khi {@code force}. Kiểu ALL: người thực hiện tích = xong PHẦN MÌNH; việc xong khi người
     * cuối tích; người sửa được mà không thực hiện tích = hoàn thành cả việc.
     */
    @Transactional
    public KpiTaskResponse changeStatus(UUID taskId, ChangeKpiTaskStatusRequest req) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, req.getVersion(), false);
        StatusOutcome outcome = applyStatus(me, task, req.getStatus(), req.getSortOrder(), req.isForce());
        return assembler.toResponses(me, List.of(outcome.task()), false).get(0);
    }

    record StatusOutcome(KpiTask task, boolean becameDone) {}

    /** Lõi đổi trạng thái (dùng chung cho API, thao tác hàng loạt, tự động hoá). Người gọi đã kiểm quyền sửa. */
    StatusOutcome applyStatus(User me, KpiTask task, KpiTaskStatus target, Double sortOrder, boolean force) {
        KpiTaskStatus old = task.getStatus();
        boolean toDone = target == KpiTaskStatus.DONE && old != KpiTaskStatus.DONE;
        if (toDone && !force) {
            long open = taskRepository.countOpenSubtasks(task.getId());
            if (open > 0) throw new StaleStateException(ErrorCode.TASK_PARENT_HAS_OPEN_SUBTASKS, open);
            long blockers = dependencyRepository.countOpenBlockers(task.getId());
            if (blockers > 0) throw new StaleStateException(ErrorCode.TASK_BLOCKED_BY_OPEN, blockers);
        }
        List<KpiTaskAssignee> rows = assigneeRepository.findByTaskIdOrderByAddedAtAsc(task.getId());
        KpiTaskAssignee mine = rows.stream().filter(a -> a.getUserId().equals(me.getId())).findFirst().orElse(null);
        Instant now = Instant.now();
        KpiTaskStatus effective = target;

        if (task.getCompletionMode() == TaskCompletionMode.ALL && mine != null) {
            if (toDone) {
                // Tích phần của mình; việc chỉ xong khi mọi người đã tích.
                mine.setCompletedAt(now);
                assigneeRepository.save(mine);
                log(task, me, KpiTaskEventAction.PART_COMPLETED, null, me.getId().toString());
                boolean allDone = rows.stream().allMatch(a -> a.getCompletedAt() != null);
                if (!allDone) effective = old == KpiTaskStatus.TODO ? KpiTaskStatus.IN_PROGRESS : old;
            } else if (target != KpiTaskStatus.DONE && mine.getCompletedAt() != null) {
                // Bỏ tích phần mình: việc (nếu đã xong) mở lại.
                mine.setCompletedAt(null);
                assigneeRepository.save(mine);
                log(task, me, KpiTaskEventAction.PART_REOPENED, null, me.getId().toString());
            }
        } else if (toDone) {
            for (KpiTaskAssignee a : rows) {
                if (a.getCompletedAt() == null && (task.getCompletionMode() == TaskCompletionMode.ALL || a == mine || mine == null)) {
                    a.setCompletedAt(now);
                    assigneeRepository.save(a);
                }
            }
        } else if (old == KpiTaskStatus.DONE && target != KpiTaskStatus.DONE) {
            assigneeRepository.clearCompletion(task.getId());
        }

        boolean becameDone = effective == KpiTaskStatus.DONE && old != KpiTaskStatus.DONE;
        if (old != effective) {
            task.setStatus(effective);
            task.setCompletedAt(effective == KpiTaskStatus.DONE ? now : null);
            log(task, me, KpiTaskEventAction.STATUS_CHANGED, old.name(), effective.name());
        }
        task.setSortOrder(sortOrder != null ? sortOrder
                : (old != effective ? taskRepository.maxSortOrder(task.getOwner().getId(), effective) + 1 : task.getSortOrder()));
        task = taskRepository.saveAndFlush(task);
        if (becameDone && task.getRecurrence() != null) {
            spawnNext(task, me);
            taskRepository.flush();
        }
        if (old != effective) {
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(),
                    becameDone ? TaskEvents.Kind.COMPLETED : TaskEvents.Kind.STATUS_CHANGED));
            if (task.getParentTaskId() != null) {
                events.publishEvent(TaskEvents.Changed.of(task.getParentTaskId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
            }
            events.publishEvent(new TaskListEvents.StatusChanged(task.getId(), me.getId(), old, effective));
        } else {
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.UPDATED));
        }
        return new StatusOutcome(task, becameDone);
    }

    // ══ Người thực hiện / KPI ════════════════════════════════════════════════════════════════════

    /**
     * Giao / giao lại người CHÍNH (giữ những người thực hiện khác), có thể kèm đổi KPI (việc gốc). Đổi KPI chạy lại toàn
     * bộ luật trên KPI đích cho cả cây; người theo dõi không xem được KPI mới bị gỡ khi đã xác nhận.
     */
    @Transactional
    public KpiTaskResponse assign(UUID taskId, AssignKpiTaskRequest req) {
        User me = currentUser();
        lockTree(taskId);
        KpiTask task = findTask(taskId);
        if (!access.canReassign(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (!req.getVersion().equals(task.getVersion())) throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        TaskKpiLinks.Link from = kpiLinks.of(task);
        if (from.active()) cycleStatusGuard.assertWritable(from.kpi());

        boolean subtask = !task.isRoot();
        if (subtask && req.getKpiId() != null && !req.getKpiId().equals(task.getKpiCriteriaId())) {
            throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);
        }
        TaskKpiLinks.Link to = subtask || req.getKpiId() == null ? from : kpiLinks.ofKpiId(req.getKpiId());
        if (to.deleted()) throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);

        UUID previousOwner = task.getOwner().getId();
        List<UUID> next = new ArrayList<>(assigneeRepository.findUserIds(task.getId()));
        next.remove(previousOwner);
        next.remove(req.getOwnerId());
        next.add(0, req.getOwnerId());
        boolean kpiChanged = !Objects.equals(to.kpiId(), from.kpiId());
        if (kpiChanged) {
            changeTreeKpi(me, task, to, next, req.getConfirmedFollowerRemovals());
        }
        Set<UUID> existing = kpiChanged ? Set.of() : new HashSet<>(assigneeRepository.findUserIds(task.getId()));
        List<User> users = validateAssignees(me, to, task.getOrganizationId(), next, subtask, existing);
        writeAssignees(me, task, users);
        task = taskRepository.saveAndFlush(task);
        boolean ownerChanged = !previousOwner.equals(req.getOwnerId());
        if (ownerChanged) {
            log(task, me, KpiTaskEventAction.REASSIGNED, previousOwner.toString(), req.getOwnerId().toString());
            events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, previousOwner, req.getOwnerId()));
        } else if (kpiChanged) {
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.KPI_CHANGED));
        }
        return assembler.detail(me, task);
    }

    /** Thay danh sách người thực hiện (giữ KPI). */
    @Transactional
    public KpiTaskResponse setAssignees(UUID taskId, SetTaskAssigneesRequest req) {
        User me = currentUser();
        lockTree(taskId);
        KpiTask task = findTask(taskId);
        if (!access.canReassign(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (!req.getVersion().equals(task.getVersion())) throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        TaskKpiLinks.Link link = kpiLinks.assertWritable(task, false);
        List<UUID> ids = new ArrayList<>(new LinkedHashSet<>(req.getAssigneeIds().stream().filter(Objects::nonNull).toList()));
        if (req.getPrimaryId() != null && ids.remove(req.getPrimaryId())) ids.add(0, req.getPrimaryId());
        UUID previousOwner = task.getOwner().getId();
        Set<UUID> before = new HashSet<>(assigneeRepository.findUserIds(task.getId()));
        List<User> users = validateAssignees(me, link, task.getOrganizationId(), ids, !task.isRoot(), before);
        writeAssignees(me, task, users);
        if (req.getCompletionMode() != null && req.getCompletionMode() != task.getCompletionMode()) {
            log(task, me, KpiTaskEventAction.COMPLETION_MODE_CHANGED, task.getCompletionMode().name(), req.getCompletionMode().name());
            task.setCompletionMode(req.getCompletionMode());
        }
        task = taskRepository.saveAndFlush(task);
        for (User u : users) {
            if (!before.contains(u.getId())) {
                log(task, me, KpiTaskEventAction.ASSIGNEE_ADDED, null, u.getId().toString());
                if (!u.getId().equals(me.getId())) {
                    events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, null, u.getId()));
                }
            }
        }
        Set<UUID> after = users.stream().map(User::getId).collect(Collectors.toSet());
        for (UUID b : before) {
            if (!after.contains(b)) {
                log(task, me, KpiTaskEventAction.ASSIGNEE_REMOVED, b.toString(), null);
                events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, b, null));
            }
        }
        if (!previousOwner.equals(task.getOwner().getId())) {
            log(task, me, KpiTaskEventAction.REASSIGNED, previousOwner.toString(), task.getOwner().getId().toString());
        }
        return assembler.detail(me, task);
    }

    /**
     * Gắn / đổi / gỡ KPI của việc GỐC (cả cây đi theo). Gỡ: kỳ của KPI hiện tại phải chưa khoá; KPI đã xoá thì không gỡ
     * được (chỉ đổi sang KPI khác). Gắn / đổi: luật giao việc đầy đủ trên KPI đích (docs/TASKS_DESIGN.md §2).
     */
    @Transactional
    public KpiTaskResponse setKpi(UUID taskId, SetTaskKpiRequest req) {
        User me = currentUser();
        lockTree(taskId);
        KpiTask task = findTask(taskId);
        if (!task.isRoot()) throw new BusinessException(ErrorCode.TASK_KPI_ONLY_ROOT);
        if (!access.canReassign(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (!req.getVersion().equals(task.getVersion())) throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        TaskKpiLinks.Link from = kpiLinks.of(task);
        TaskKpiLinks.Link to = req.getKpiId() == null ? TaskKpiLinks.Link.NONE : kpiLinks.ofKpiId(req.getKpiId());
        if (to.deleted()) throw new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID);
        if (Objects.equals(from.kpiId(), to.kpiId())) return assembler.detail(me, task);
        changeTreeKpi(me, task, to, assigneeRepository.findUserIds(task.getId()), req.getConfirmedFollowerRemovals());
        task = taskRepository.saveAndFlush(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.KPI_CHANGED));
        return assembler.detail(me, task);
    }

    /**
     * Đổi KPI của cả cây {@code root}: kiểm khoá kỳ KPI cũ (gỡ khỏi kỳ đã khoá bị chặn), KPI đã xoá thì chỉ đổi sang KPI
     * khác; KPI đích: trạng thái nhận việc, kỳ chưa khoá, cùng tổ chức, MỌI người thực hiện của MỌI việc trong cây thuộc
     * KPI và người làm được giao cho họ; người theo dõi không xem được KPI đích bị gỡ (đã xác nhận). {@code rootAssignees}:
     * người thực hiện của gốc SAU thao tác (giao lại kèm đổi KPI).
     */
    private void changeTreeKpi(User me, KpiTask root, TaskKpiLinks.Link to, List<UUID> rootAssignees,
                               List<FollowerRemovalRef> confirmed) {
        TaskKpiLinks.Link from = kpiLinks.of(root);
        if (from.active()) cycleStatusGuard.assertWritable(from.kpi());
        if (from.deleted() && to.none()) throw new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY);
        List<KpiTask> tree = new ArrayList<>();
        tree.add(root);
        tree.addAll(taskRepository.findDescendants(root.getId()));
        if (to.active()) {
            KpiCriteria kpi = to.kpi();
            if (!TASKABLE.contains(kpi.getStatus())) throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, kpi.getStatus().name());
            cycleStatusGuard.assertWritable(kpi);
            if (!Objects.equals(KpiAccessPolicy.organizationIdOf(kpi), root.getOrganizationId())) {
                throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);
            }
            Map<UUID, List<UUID>> assigneesByTask = new HashMap<>();
            for (KpiTaskAssignee a : assigneeRepository.findByTaskIdIn(tree.stream().map(KpiTask::getId).toList())) {
                assigneesByTask.computeIfAbsent(a.getTaskId(), k -> new ArrayList<>()).add(a.getUserId());
            }
            assigneesByTask.put(root.getId(), rootAssignees);
            for (KpiTask t : tree) {
                validateAssignees(me, to, root.getOrganizationId(), assigneesByTask.getOrDefault(t.getId(), List.of()), !t.isRoot());
            }
            removeFollowersForKpiChange(me, followerRemovals(List.of(root), kpi), confirmed);
        }
        for (KpiTask t : tree) {
            t.setKpiCriteriaId(to.kpiId());
            t.setKpiNameSnapshot(null);
            if (t != root) taskRepository.save(t);
        }
        KpiTaskEventAction action = to.none() ? KpiTaskEventAction.KPI_UNLINKED
                : from.none() ? KpiTaskEventAction.KPI_LINKED : KpiTaskEventAction.KPI_MOVED;
        log(root, me, action, from.kpiId() != null ? from.kpiId().toString() : null, to.kpiId() != null ? to.kpiId().toString() : null);
    }

    /**
     * Từ chối việc (chỉ việc không KPI, người khác giao). Mình bị gỡ khỏi người thực hiện; hết người ⇒ việc quay về người
     * giao (người tạo) — không có trạng thái "chưa có người phụ trách". Người giao nhận thông báo kèm lý do.
     */
    @Transactional
    public KpiTaskResponse decline(UUID taskId, DeclineTaskRequest req) {
        User me = currentUser();
        lockTree(taskId);
        KpiTask task = findTask(taskId);
        KpiTaskAccess.Scope scope = access.scope(me.getId(), List.of(task));
        boolean open = task.getStatus() == KpiTaskStatus.TODO || task.getStatus() == KpiTaskStatus.IN_PROGRESS;
        if (!scope.canDecline(task) || !open) throw new BusinessException(ErrorCode.TASK_DECLINE_NOT_ALLOWED);
        assigneeRepository.deleteOne(task.getId(), me.getId());
        assigneeRepository.flush();
        List<UUID> remaining = assigneeRepository.findUserIds(task.getId());
        User creator = userRepository.findById(task.getCreatedBy()).orElseThrow(() -> new BusinessException(ErrorCode.TASK_DECLINE_NOT_ALLOWED));
        if (remaining.isEmpty()) {
            assigneeRepository.save(KpiTaskAssignee.builder().taskId(task.getId()).userId(creator.getId()).addedBy(me.getId()).build());
            task.setOwner(creator);
        } else if (task.getOwner().getId().equals(me.getId())) {
            task.setOwner(userRepository.findById(remaining.get(0)).orElse(creator));
        }
        String reason = blankToNull(req.getReason());
        log(task, me, KpiTaskEventAction.DECLINED, me.getId().toString(), reason != null ? truncate(reason, 500) : null);
        task = taskRepository.saveAndFlush(task);
        events.publishEvent(new TaskEvents.Declined(task.getId(), me.getId(), creator.getId(), reason));
        events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.UPDATED, me.getId(), null));
        return access.canView(me.getId(), task) ? assembler.detail(me, task) : null;
    }

    /** Xem trước "Giao / chuyển KPI": những ai sẽ bị gỡ khỏi việc nào nếu chuyển việc sang {@code kpiId}. */
    @Transactional(readOnly = true)
    public List<TaskFollowerRemovalResponse> assignImpact(UUID taskId, UUID kpiId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canReassign(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (!task.isRoot() || kpiId == null || kpiId.equals(task.getKpiCriteriaId())) return List.of();
        KpiCriteria kpi = kpiCriteriaRepository.findById(kpiId)
                .filter(k -> kpiAccessPolicy.canView(me.getId(), k))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID));
        return toRemovalResponses(followerRemovals(List.of(task), kpi));
    }

    /** Xem trước "Chuyển việc sang KPI khác" ({@link #move}). */
    @Transactional(readOnly = true)
    public List<TaskFollowerRemovalResponse> moveImpact(UUID fromKpiId, UUID toKpiId, List<UUID> taskIds) {
        MovePlan plan = planMove(currentUser(), fromKpiId, toKpiId, taskIds);
        return toRemovalResponses(followerRemovals(plan.tasks(), plan.to()));
    }

    // ══ Người theo dõi ═══════════════════════════════════════════════════════════════════════════

    /**
     * Thêm người theo dõi: người sửa được task thêm bất kỳ ai hợp lệ (việc có KPI: xem được KPI; không KPI: cùng tổ chức);
     * người xem được task tự theo dõi được. Khoá cây việc TRƯỚC khi đọc KPI, để không chen vào giữa một lần đổi KPI.
     */
    @Transactional
    public KpiTaskResponse addFollower(UUID taskId, UUID userId) {
        User me = currentUser();
        lockTree(taskId);
        KpiTask task = findTask(taskId);
        boolean self = userId.equals(me.getId());
        if (!(access.canEdit(me.getId(), task) || (self && access.canView(me.getId(), task)))) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        TaskKpiLinks.Link link = kpiLinks.assertWritable(task, false);
        if (assigneeRepository.existsByTaskIdAndUserId(taskId, userId)) return assembler.detail(me, task);
        assertFollowerAllowed(userId, link, task.getOrganizationId());
        if (!followerRepository.existsByTaskIdAndUserId(taskId, userId)) {
            followerRepository.save(KpiTaskFollower.builder().taskId(taskId).userId(userId).addedBy(me.getId()).build());
            log(task, me, KpiTaskEventAction.FOLLOWER_ADDED, null, userId.toString());
            events.publishEvent(new TaskEvents.Changed(taskId, me.getId(), TaskEvents.Kind.FOLLOWER_ADDED, null, userId));
        }
        return assembler.detail(me, task);
    }

    @Transactional
    public KpiTaskResponse removeFollower(UUID taskId, UUID userId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        boolean self = userId.equals(me.getId());
        if (!(access.canEdit(me.getId(), task) || (self && access.isFollower(me.getId(), task)))) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        TaskKpiLinks.Link link = kpiLinks.of(task);
        if (link.active()) cycleStatusGuard.assertWritable(link.kpi());
        if (followerRepository.existsByTaskIdAndUserId(taskId, userId)) {
            followerRepository.deleteById(new KpiTaskFollower.Key(taskId, userId));
            log(task, me, KpiTaskEventAction.FOLLOWER_REMOVED, userId.toString(), null);
            events.publishEvent(new TaskEvents.Changed(taskId, me.getId(), TaskEvents.Kind.FOLLOWER_REMOVED, null, userId));
        }
        return self && !access.canView(me.getId(), task) ? null : assembler.detail(me, task);
    }

    @Transactional
    public KpiTaskResponse setReminders(UUID taskId, List<KpiTaskReminderInput> reminders) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        reminderPlanner.replace(task, reminders == null ? List.of() : reminders);
        log(task, me, KpiTaskEventAction.REMINDERS_CHANGED, null, String.valueOf(reminders == null ? 0 : reminders.size()));
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.REMINDERS_CHANGED));
        return assembler.detail(me, task);
    }

    // ══ Nhân bản / xoá ═══════════════════════════════════════════════════════════════════════════

    /**
     * Nhân bản: cùng KPI, cùng người thực hiện (người mình còn được giao — không thì là mình), checklist bỏ tích, người
     * theo dõi, nhắc, nhãn, danh sách (mình là biên tập) + trường.
     */
    @Transactional
    public KpiTaskResponse duplicate(UUID taskId) {
        User me = currentUser();
        KpiTask src = editable(me, taskId, null, false);
        TaskKpiLinks.Link link = kpiLinks.of(src);
        List<UUID> keep = new ArrayList<>();
        for (UUID a : assigneeRepository.findUserIds(src.getId())) {
            boolean ok = link.active() ? KpiTaskAccess.isKpiOf(a, link.kpi()) && access.canAssign(me.getId(), a, link.kpi())
                    : access.canAssignWithoutKpi(me.getId(), a, src.getOrganizationId());
            if (ok) keep.add(a);
        }
        if (keep.isEmpty()) keep.add(me.getId());
        List<User> users = validateAssignees(me, link, src.getOrganizationId(), keep, !src.isRoot());
        KpiTask copy = taskRepository.save(KpiTask.builder()
                .organizationId(src.getOrganizationId()).kpiCriteriaId(src.getKpiCriteriaId()).parentTaskId(src.getParentTaskId())
                .rootTaskId(src.getRootTaskId()).ancestorIds(src.getAncestorIds()).depth(src.getDepth())
                .title(src.getTitle()).description(src.getDescription()).descriptionDoc(src.getDescriptionDoc())
                .startDate(src.getStartDate()).startTime(src.getStartTime())
                .dueDate(src.getDueDate()).dueTime(src.getDueTime()).priority(src.getPriority()).visibility(src.getVisibility())
                .completionMode(src.getCompletionMode())
                .status(KpiTaskStatus.TODO).owner(users.get(0)).createdBy(me.getId())
                .sortOrder(taskRepository.maxSortOrder(users.get(0).getId(), KpiTaskStatus.TODO) + 1)
                .build());
        for (User u : users) assigneeRepository.save(KpiTaskAssignee.builder().taskId(copy.getId()).userId(u.getId()).addedBy(me.getId()).build());
        copyChildren(src, copy, me);
        if (copy.isRoot()) {
            Map<UUID, TaskListRole> roles = listAccess.rolesOf(me.getId());
            for (TaskListItem i : listItemRepository.findByTaskId(src.getId())) {
                TaskListRole r = roles.get(i.getListId());
                if (r == null || !r.atLeast(TaskListRole.EDITOR)) continue;
                listItemRepository.save(TaskListItem.builder().listId(i.getListId()).taskId(copy.getId()).sectionId(i.getSectionId())
                        .sortOrder(i.getSortOrder() + 0.5).addedBy(me.getId()).build());
                Set<UUID> fieldIds = fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(i.getListId()).stream()
                        .map(TaskListField::getId).collect(Collectors.toSet());
                for (TaskFieldValue v : fieldValueRepository.findByTaskId(src.getId())) {
                    if (!fieldIds.contains(v.getFieldId())) continue;
                    fieldValueRepository.save(TaskFieldValue.builder().taskId(copy.getId()).fieldId(v.getFieldId())
                            .value(v.getValue()).updatedBy(me.getId()).build());
                }
            }
        }
        log(copy, me, KpiTaskEventAction.DUPLICATED, src.getId().toString(), null);
        events.publishEvent(TaskEvents.Changed.of(copy.getId(), me.getId(), TaskEvents.Kind.CREATED));
        for (User u : users) {
            if (!u.getId().equals(me.getId())) {
                events.publishEvent(new TaskEvents.Changed(copy.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, null, u.getId()));
            }
        }
        return assembler.detail(me, copy);
    }

    /** Xoá (mềm) — người tạo, hoặc chủ danh sách (việc không KPI); mọi hậu duệ đi theo. */
    @Transactional
    public void delete(UUID taskId) {
        User me = currentUser();
        deleteInternal(me, taskId);
    }

    void deleteInternal(User me, UUID taskId) {
        KpiTask task = findTask(taskId);
        if (!access.canDelete(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_DELETE_NOT_CREATOR : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        kpiLinks.assertWritable(task, true);
        Instant now = Instant.now();
        for (KpiTask d : taskRepository.findDescendants(task.getId())) {
            d.setDeletedAt(now);
            taskRepository.save(d);
        }
        task.setDeletedAt(now);
        taskRepository.save(task);
        log(task, me, KpiTaskEventAction.DELETED, null, null);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.DELETED));
        if (task.getParentTaskId() != null) {
            events.publishEvent(TaskEvents.Changed.of(task.getParentTaskId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        }
    }

    // ══ Checklist / tệp ══════════════════════════════════════════════════════════════════════════

    @Transactional
    public KpiTaskResponse addChecklistItem(UUID taskId, KpiTaskChecklistRequest req) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        String title = requireTitle(req.getTitle());
        int next = checklistRepository.findByTaskIdOrderBySortOrderAscCreatedAtAsc(taskId).stream()
                .mapToInt(KpiTaskChecklistItem::getSortOrder).max().orElse(-1) + 1;
        checklistRepository.save(KpiTaskChecklistItem.builder().taskId(taskId).title(truncate(title, 500))
                .done(Boolean.TRUE.equals(req.getDone())).sortOrder(next).build());
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.CHECKLIST_CHANGED));
        return assembler.detail(me, task);
    }

    @Transactional
    public KpiTaskResponse updateChecklistItem(UUID taskId, UUID itemId, KpiTaskChecklistRequest req) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        KpiTaskChecklistItem item = checklistItem(taskId, itemId);
        if (req.getTitle() != null) item.setTitle(truncate(requireTitle(req.getTitle()), 500));
        if (req.getDone() != null) item.setDone(req.getDone());
        if (req.getSortOrder() != null) item.setSortOrder(req.getSortOrder());
        checklistRepository.save(item);
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.CHECKLIST_CHANGED));
        return assembler.detail(me, task);
    }

    @Transactional
    public KpiTaskResponse deleteChecklistItem(UUID taskId, UUID itemId) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        checklistRepository.delete(checklistItem(taskId, itemId));
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.CHECKLIST_CHANGED));
        return assembler.detail(me, task);
    }

    /** Tệp đi lên NGOÀI transaction — khuôn chung {@link CloudinaryStorageService#uploadThenSave}. */
    public KpiTaskResponse addAttachments(UUID taskId, MultipartFile[] files) throws IOException {
        return addAttachments(taskId, files, null);
    }

    /** {@code sourceDocumentIds[i]}: tài liệu thư viện mà {@code files[i]} được sao từ đó ("" / "-" = tệp từ máy). */
    public KpiTaskResponse addAttachments(UUID taskId, MultipartFile[] files, List<String> sourceDocumentIds) throws IOException {
        if (files == null || files.length == 0) throw new BusinessException(ErrorCode.NO_FILE_SELECTED_ATTACH);
        return storage.uploadThenSave(files, "tasks/" + taskId, () -> {
            User me = currentUser();
            KpiTask task = editable(me, taskId, null, false);
            attachmentPolicy.validate(files, attachmentRepository.countByTaskId(taskId),
                    CollabAttachmentPolicy.MAX_FILES_PER_TASK, ErrorCode.TASK_TOO_MANY_FILES);
            return new AttachContext(me, task);
        }, (ctx, stored) -> {
            Map<MultipartFile, AttachmentLibrarySources.Source> sources = librarySources.link(
                    files, sourceDocumentIds, ctx.me().getId(), ctx.task().getOrganizationId());
            for (CloudinaryStorageService.StoredFile f : stored) {
                MultipartFile file = f.source();
                AttachmentLibrarySources.Source src = sources.get(file);
                attachmentRepository.save(KpiTaskAttachment.builder()
                        .taskId(taskId)
                        .fileName(attachmentPolicy.safeFileName(file.getOriginalFilename()))
                        .fileUrl(f.url())
                        .fileSize(file.getSize())
                        .contentType(file.getContentType())
                        .storageProvider(StorageProvider.CLOUDINARY)
                        .storageKey(f.publicId())
                        .uploadedBy(ctx.me().getId())
                        .sourceDocumentId(src != null ? src.documentId() : null)
                        .sourceDocumentTitle(src != null ? src.title() : null)
                        .build());
            }
            events.publishEvent(TaskEvents.Changed.of(taskId, ctx.me().getId(), TaskEvents.Kind.ATTACHMENTS_CHANGED));
            return assembler.detail(ctx.me(), ctx.task());
        });
    }

    private record AttachContext(User me, KpiTask task) {}

    @Transactional
    public KpiTaskResponse deleteAttachment(UUID taskId, UUID attachmentId) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        KpiTaskAttachment att = attachmentRepository.findById(attachmentId)
                .filter(a -> a.getTaskId().equals(taskId))
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.attachment"), "id", attachmentId));
        if (att.getStorageKey() != null) storage.deleteFile(att.getStorageKey(), att.getContentType());
        attachmentRepository.delete(att);
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.ATTACHMENTS_CHANGED));
        return assembler.detail(me, task);
    }

    // ══ Nhãn ═════════════════════════════════════════════════════════════════════════════════════

    /** Thay bộ nhãn của việc (nhãn phải cùng tổ chức với việc). */
    @Transactional
    public KpiTaskResponse setTags(UUID taskId, List<UUID> tagIds) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        setTagsInternal(task, tagIds == null ? List.of() : tagIds);
        log(task, me, KpiTaskEventAction.TAGS_CHANGED, null, String.valueOf(tagIds == null ? 0 : tagIds.size()));
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.TAGS_CHANGED));
        return assembler.detail(me, task);
    }

    void setTagsInternal(KpiTask task, Collection<UUID> tagIds) {
        Set<UUID> wanted = new LinkedHashSet<>(tagIds);
        List<TaskTag> tags = wanted.isEmpty() ? List.of() : tagRepository.findAllById(wanted);
        if (tags.size() != wanted.size() || tags.stream().anyMatch(t -> !t.getOrganizationId().equals(task.getOrganizationId()))) {
            throw new BusinessException(ErrorCode.TASK_TAG_NOT_FOUND);
        }
        tagLinkRepository.deleteByTaskId(task.getId());
        tagLinkRepository.flush();
        for (UUID id : wanted) tagLinkRepository.save(TaskTagLink.builder().taskId(task.getId()).tagId(id).build());
    }

    // ══ Phụ thuộc ════════════════════════════════════════════════════════════════════════════════

    /** {@code successorId} chờ {@code predecessorId} (FS). Cần sửa được việc sau và xem được việc trước; chặn vòng. */
    @Transactional
    public KpiTaskResponse addDependency(UUID successorId, UUID predecessorId) {
        User me = currentUser();
        KpiTask succ = editable(me, successorId, null, false);
        KpiTask pred = findTask(predecessorId);
        if (!access.canView(me.getId(), pred)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        if (succ.getId().equals(pred.getId()) || !succ.getOrganizationId().equals(pred.getOrganizationId())) {
            throw new BusinessException(ErrorCode.TASK_DEPENDENCY_INVALID);
        }
        if (dependencyRepository.existsByPredecessorIdAndSuccessorId(pred.getId(), succ.getId())) return assembler.detail(me, succ);
        if (dependencyRepository.reachable(succ.getId(), pred.getId())) throw new BusinessException(ErrorCode.TASK_DEPENDENCY_CYCLE);
        dependencyRepository.save(TaskDependency.builder().predecessorId(pred.getId()).successorId(succ.getId()).createdBy(me.getId()).build());
        log(succ, me, KpiTaskEventAction.DEPENDENCY_ADDED, null, pred.getTitle());
        events.publishEvent(TaskEvents.Changed.of(succ.getId(), me.getId(), TaskEvents.Kind.DEPENDENCIES_CHANGED));
        events.publishEvent(TaskEvents.Changed.of(pred.getId(), me.getId(), TaskEvents.Kind.DEPENDENCIES_CHANGED));
        return assembler.detail(me, succ);
    }

    /** Gỡ một phụ thuộc — người sửa được MỘT trong hai việc. */
    @Transactional
    public void removeDependency(UUID dependencyId) {
        User me = currentUser();
        TaskDependency d = dependencyRepository.findById(dependencyId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_DEPENDENCY_INVALID));
        KpiTask succ = findTask(d.getSuccessorId());
        KpiTask pred = taskRepository.findById(d.getPredecessorId()).orElse(null);
        boolean ok = access.canEdit(me.getId(), succ) || (pred != null && access.canEdit(me.getId(), pred));
        if (!ok) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_EDIT);
        kpiLinks.assertWritable(succ, false);
        dependencyRepository.delete(d);
        log(succ, me, KpiTaskEventAction.DEPENDENCY_REMOVED, pred != null ? pred.getTitle() : null, null);
        events.publishEvent(TaskEvents.Changed.of(succ.getId(), me.getId(), TaskEvents.Kind.DEPENDENCIES_CHANGED));
    }

    // ══ Chuyển KPI hàng loạt ═════════════════════════════════════════════════════════════════════

    /**
     * Chuyển việc của người gọi sang KPI khác (KPI cũ được thay / đã xoá). Việc con đi theo việc cha. Mỗi cây phải thoả
     * TOÀN BỘ luật trên KPI đích — người thực hiện của mọi việc trong cây thuộc KPI và mình được giao cho họ (trước đây chỉ
     * kiểm người gọi); người theo dõi không xem được KPI mới bị gỡ nếu đã được xác nhận.
     */
    @Transactional
    public int move(MoveKpiTasksRequest req) {
        User me = currentUser();
        MovePlan plan = planMove(me, req.getFromKpiId(), req.getToKpiId(), req.getTaskIds());
        List<KpiTask> tasks = plan.tasks();
        if (!tasks.isEmpty()) taskRepository.lockRows(tasks.stream().map(KpiTask::getId).toList());
        KpiCriteria to = plan.to();
        cycleStatusGuard.assertWritable(to);
        // KPI nguồn đã khoá kỳ thì task của nó chỉ đọc — không chuyển đi được. KPI nguồn đã xoá thì không cần kiểm.
        kpiCriteriaRepository.findById(req.getFromKpiId()).ifPresent(cycleStatusGuard::assertWritable);
        TaskKpiLinks.Link target = new TaskKpiLinks.Link(TaskKpiLinks.State.ACTIVE, to.getId(), to);

        removeFollowersForKpiChange(me, followerRemovals(tasks, to), req.getConfirmedFollowerRemovals());
        for (KpiTask t : tasks) {
            List<KpiTask> tree = new ArrayList<>();
            tree.add(t);
            tree.addAll(taskRepository.findDescendants(t.getId()));
            for (KpiTask x : tree) validateAssignees(me, target, t.getOrganizationId(), assigneeRepository.findUserIds(x.getId()), !x.isRoot());
            log(t, me, KpiTaskEventAction.KPI_MOVED, t.getKpiCriteriaId().toString(), to.getId().toString());
            for (KpiTask x : tree) moveTo(x, to);
            events.publishEvent(TaskEvents.Changed.of(t.getId(), me.getId(), TaskEvents.Kind.KPI_CHANGED));
        }
        return tasks.size();
    }

    private void moveTo(KpiTask t, KpiCriteria to) {
        t.setKpiCriteriaId(to.getId());
        t.setOrganizationId(KpiAccessPolicy.organizationIdOf(to));
        t.setKpiNameSnapshot(null);
        taskRepository.save(t);
    }

    private record MovePlan(KpiCriteria to, List<KpiTask> tasks) {}

    /**
     * Kiểm KPI đích và chọn các việc sẽ chuyển — dùng chung cho {@link #move} và {@link #moveImpact} (chưa xét khoá kỳ).
     * Chỉ việc cấp cao nhất: việc con luôn đi theo việc cha, chuyển riêng việc con sẽ tách nó khỏi KPI của việc cha.
     */
    private MovePlan planMove(User me, UUID fromKpiId, UUID toKpiId, List<UUID> taskIds) {
        if (fromKpiId.equals(toKpiId)) throw new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID);
        KpiCriteria to = kpiCriteriaRepository.findById(toKpiId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID));
        if (!KpiTaskAccess.isKpiOf(me.getId(), to)) throw new ForbiddenException(ErrorCode.TASK_KPI_NOT_OWNED);
        if (!TASKABLE.contains(to.getStatus())) throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, to.getStatus().name());

        List<KpiTask> tasks = (taskIds == null || taskIds.isEmpty()
                ? taskRepository.findOpenByOwnerAndKpi(me.getId(), fromKpiId)
                : taskRepository.findAllById(taskIds)).stream()
                .filter(t -> t.getParentTaskId() == null && fromKpiId.equals(t.getKpiCriteriaId()))
                .toList();
        KpiTaskAccess.Scope scope = access.scope(me.getId(), tasks);
        for (KpiTask t : tasks) {
            if (!scope.canEdit(t)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_EDIT);
        }
        return new MovePlan(to, tasks);
    }

    // ══ Đổi KPI: người theo dõi ══════════════════════════════════════════════════════════════════

    private record FollowerRemoval(KpiTask task, UUID userId) {}

    /** Người theo dõi của các việc (và mọi hậu duệ) không xem được {@code target}. Thứ tự: việc cha rồi hậu duệ. */
    private List<FollowerRemoval> followerRemovals(List<KpiTask> tasks, KpiCriteria target) {
        Map<UUID, KpiTask> byId = new LinkedHashMap<>();
        for (KpiTask t : tasks) {
            byId.put(t.getId(), t);
            for (KpiTask sub : taskRepository.findDescendants(t.getId())) byId.put(sub.getId(), sub);
        }
        if (byId.isEmpty()) return List.of();
        Map<UUID, List<UUID>> followersByTask = new HashMap<>();
        for (KpiTaskFollower f : followerRepository.findByTaskIdIn(byId.keySet())) {
            followersByTask.computeIfAbsent(f.getTaskId(), k -> new ArrayList<>()).add(f.getUserId());
        }
        Map<UUID, Boolean> canView = new HashMap<>();
        List<FollowerRemoval> out = new ArrayList<>();
        byId.values().forEach(t -> followersByTask.getOrDefault(t.getId(), List.of()).stream().sorted()
                .filter(u -> !canView.computeIfAbsent(u, id -> kpiAccessPolicy.canView(id, target)))
                .forEach(u -> out.add(new FollowerRemoval(t, u))));
        return out;
    }

    /**
     * Gỡ người theo dõi khi đổi KPI. Cho qua khi mọi cặp (việc, người) thực tế nằm trong danh sách đã xác nhận — ít hơn
     * thì vẫn an toàn (vd. có người tự bỏ theo dõi giữa chừng); có cặp chưa được xác nhận thì chặn
     * ({@code TASK_FOLLOWER_REMOVAL_UNCONFIRMED}) để giao diện xem lại. Mỗi lần gỡ ghi lịch sử kèm lý do và người làm,
     * mỗi người bị gỡ nhận MỘT thông báo.
     */
    private void removeFollowersForKpiChange(User me, List<FollowerRemoval> removals, List<FollowerRemovalRef> confirmed) {
        if (removals.isEmpty()) return;
        Set<FollowerRemovalRef> ok = confirmed == null ? Set.of() : new HashSet<>(confirmed);
        if (removals.stream().anyMatch(r -> !ok.contains(new FollowerRemovalRef(r.task().getId(), r.userId())))) {
            throw new BusinessException(ErrorCode.TASK_FOLLOWER_REMOVAL_UNCONFIRMED);
        }
        Map<UUID, List<UUID>> tasksByUser = new LinkedHashMap<>();
        for (FollowerRemoval r : removals) {
            followerRepository.deleteById(new KpiTaskFollower.Key(r.task().getId(), r.userId()));
            log(r.task(), me, KpiTaskEventAction.FOLLOWER_REMOVED, r.userId().toString(), FOLLOWER_REMOVED_KPI_CHANGED);
            tasksByUser.computeIfAbsent(r.userId(), k -> new ArrayList<>()).add(r.task().getId());
        }
        tasksByUser.forEach((userId, taskIds) -> events.publishEvent(new TaskEvents.FollowersRevoked(me.getId(), userId, taskIds)));
    }

    private List<TaskFollowerRemovalResponse> toRemovalResponses(List<FollowerRemoval> removals) {
        if (removals.isEmpty()) return List.of();
        Map<UUID, User> users = userRepository.findAllById(removals.stream().map(FollowerRemoval::userId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return removals.stream().map(r -> {
            User u = users.get(r.userId());
            return TaskFollowerRemovalResponse.builder()
                    .taskId(r.task().getId()).taskTitle(r.task().getTitle()).subtask(r.task().getParentTaskId() != null)
                    .userId(r.userId()).userName(u != null ? u.getFullName() : null).avatarUrl(u != null ? u.getAvatarUrl() : null)
                    .build();
        }).toList();
    }

    /**
     * Khoá dòng việc gốc của cây (việc cha + hậu duệ dùng chung một KPI) trước khi nạp việc. Đổi KPI và thêm người theo
     * dõi đều đi qua đây nên không chen được vào nhau.
     */
    private void lockTree(UUID taskId) {
        taskRepository.rootIdOf(taskId).ifPresent(root -> taskRepository.lockRows(List.of(root)));
    }

    // ══ Lặp lại ══════════════════════════════════════════════════════════════════════════════════

    /**
     * VIỆC vừa chuyển sang DONE ⇒ tạo lần kế tiếp (hạn tính từ hạn cũ; ngày bắt đầu dời cùng khoảng). Không tạo khi: quá
     * ngày kết thúc / đủ số lần, (việc có KPI) vượt đợt, KPI không còn nhận việc, kỳ đã khoá; hoặc lần kế tiếp đã có
     * (hoàn thành lại sau khi mở lại không nhân đôi). Kiểu ALL: gọi khi người CUỐI tích — chép người thực hiện, phần đã
     * xong về rỗng.
     */
    void spawnNext(KpiTask task, User actor) {
        TaskRecurrence rule = task.getRecurrence();
        if (rule == null || task.getDueDate() == null) return;
        LocalDate next = rule.next(task.getDueDate());
        if (task.getRecurrenceEndDate() != null && next.isAfter(task.getRecurrenceEndDate())) return;
        int index = (task.getSeriesIndex() != null ? task.getSeriesIndex() : 1) + 1;
        if (rule.getCount() != null && index > rule.getCount()) return;
        TaskKpiLinks.Link link = kpiLinks.of(task);
        if (link.deleted()) return;
        if (link.active()) {
            KpiCriteria kpi = link.kpi();
            if (!TASKABLE.contains(kpi.getStatus())) return;
            KpiPeriod period = kpi.getKpiPeriod();
            if (period != null && period.getEndDate() != null && next.isAfter(LocalDate.ofInstant(period.getEndDate(), ZONE))) return;
            if (period != null && period.getKpiCycle() != null && cycleStatusGuard.isLocked(period.getKpiCycle().getId())) return;
        }

        UUID seriesId = task.getSeriesId() != null ? task.getSeriesId() : task.getId();
        if (taskRepository.existsBySeriesIdAndSeriesIndex(seriesId, index)) return;
        if (task.getSeriesId() == null) {
            task.setSeriesId(seriesId);
            task.setSeriesIndex(1);
            taskRepository.save(task);
        }
        long shift = ChronoUnit.DAYS.between(task.getDueDate(), next);

        TaskRecurrence.Template tpl = rule.getTemplate();
        KpiTask nextTask = taskRepository.save(KpiTask.builder()
                .organizationId(task.getOrganizationId())
                .kpiCriteriaId(task.getKpiCriteriaId())
                .parentTaskId(task.getParentTaskId())
                .rootTaskId(task.getRootTaskId())
                .ancestorIds(task.getAncestorIds())
                .depth(task.getDepth())
                .title(tpl != null && tpl.getTitle() != null ? tpl.getTitle() : task.getTitle())
                .description(tpl != null && tpl.getDescription() != null ? tpl.getDescription() : task.getDescription())
                .descriptionDoc(tpl != null && tpl.getDescriptionDoc() != null ? tpl.getDescriptionDoc() : task.getDescriptionDoc())
                .priority(tpl != null && tpl.getPriority() != null ? KpiTaskPriority.valueOf(tpl.getPriority()) : task.getPriority())
                .visibility(tpl != null && tpl.getVisibility() != null ? KpiTaskVisibility.valueOf(tpl.getVisibility()) : task.getVisibility())
                .startDate(task.getStartDate() != null ? task.getStartDate().plusDays(shift) : null)
                .startTime(task.getStartTime())
                .dueDate(next)
                .dueTime(tpl != null && tpl.getDueTime() != null ? tpl.getDueTime() : task.getDueTime())
                .completionMode(task.getCompletionMode())
                .status(KpiTaskStatus.TODO)
                .owner(task.getOwner())
                .createdBy(task.getCreatedBy())
                .sortOrder(taskRepository.maxSortOrder(task.getOwner().getId(), KpiTaskStatus.TODO) + 1)
                .recurrence(copyRule(rule))
                .recurrenceEndDate(task.getRecurrenceEndDate())
                .seriesId(seriesId)
                .seriesIndex(index)
                .build());
        for (UUID a : assigneeRepository.findUserIds(task.getId())) {
            assigneeRepository.save(KpiTaskAssignee.builder().taskId(nextTask.getId()).userId(a).addedBy(actor.getId()).build());
        }
        copyChildren(task, nextTask, actor);
        if (nextTask.isRoot()) {
            for (TaskListItem i : listItemRepository.findByTaskId(task.getId())) {
                listItemRepository.save(TaskListItem.builder().listId(i.getListId()).taskId(nextTask.getId()).sectionId(i.getSectionId())
                        .sortOrder(i.getSortOrder() + 0.001).addedBy(actor.getId()).build());
            }
            for (TaskFieldValue v : fieldValueRepository.findByTaskId(task.getId())) {
                fieldValueRepository.save(TaskFieldValue.builder().taskId(nextTask.getId()).fieldId(v.getFieldId())
                        .value(v.getValue()).updatedBy(actor.getId()).build());
            }
        }
        log(nextTask, actor, KpiTaskEventAction.RECURRED, task.getId().toString(), String.valueOf(index));
        events.publishEvent(TaskEvents.Changed.of(nextTask.getId(), actor.getId(), TaskEvents.Kind.CREATED));
    }

    /** Chép checklist (bỏ tích), người theo dõi, mốc nhắc, nhãn — không chép việc con, tệp, bình luận. */
    private void copyChildren(KpiTask from, KpiTask to, User actor) {
        for (KpiTaskChecklistItem item : checklistRepository.findByTaskIdOrderBySortOrderAscCreatedAtAsc(from.getId())) {
            checklistRepository.save(KpiTaskChecklistItem.builder().taskId(to.getId()).title(item.getTitle())
                    .done(false).sortOrder(item.getSortOrder()).build());
        }
        Set<UUID> assignees = new HashSet<>(assigneeRepository.findUserIds(to.getId()));
        for (KpiTaskFollower f : followerRepository.findByTaskId(from.getId())) {
            if (assignees.contains(f.getUserId()) || f.getUserId().equals(to.getOwner().getId())) continue;
            followerRepository.save(KpiTaskFollower.builder().taskId(to.getId()).userId(f.getUserId()).addedBy(actor.getId()).build());
        }
        for (TaskTagLink l : tagLinkRepository.findByTaskId(from.getId())) {
            tagLinkRepository.save(TaskTagLink.builder().taskId(to.getId()).tagId(l.getTagId()).build());
        }
        reminderPlanner.copy(from, to);
    }

    // ══ Thao tác nội bộ (thao tác hàng loạt, tự động hoá) — người gọi đã kiểm quyền sửa việc ══════

    /** Thêm người theo dõi (bỏ qua nếu là người thực hiện / đã theo dõi); vẫn kiểm người theo dõi hợp lệ theo KPI. */
    void addFollowerInternal(User actor, KpiTask task, UUID userId) {
        TaskKpiLinks.Link link = kpiLinks.assertWritable(task, false);
        if (assigneeRepository.existsByTaskIdAndUserId(task.getId(), userId) || followerRepository.existsByTaskIdAndUserId(task.getId(), userId)) return;
        assertFollowerAllowed(userId, link, task.getOrganizationId());
        followerRepository.save(KpiTaskFollower.builder().taskId(task.getId()).userId(userId).addedBy(actor.getId()).build());
        log(task, actor, KpiTaskEventAction.FOLLOWER_ADDED, null, userId.toString());
        events.publishEvent(new TaskEvents.Changed(task.getId(), actor.getId(), TaskEvents.Kind.FOLLOWER_ADDED, null, userId));
    }

    /** Thêm một người thực hiện (giữ người cũ) theo đúng luật giao việc của trạng thái KPI. */
    void addAssigneeInternal(User actor, KpiTask task, UUID userId) {
        TaskKpiLinks.Link link = kpiLinks.assertWritable(task, false);
        List<UUID> ids = new ArrayList<>(assigneeRepository.findUserIds(task.getId()));
        if (ids.contains(userId)) return;
        Set<UUID> existing = new HashSet<>(ids);
        ids.add(userId);
        List<User> users = validateAssignees(actor, link, task.getOrganizationId(), ids, !task.isRoot(), existing);
        writeAssignees(actor, task, users);
        taskRepository.saveAndFlush(task);
        log(task, actor, KpiTaskEventAction.ASSIGNEE_ADDED, null, userId.toString());
        if (!userId.equals(actor.getId())) {
            events.publishEvent(new TaskEvents.Changed(task.getId(), actor.getId(), TaskEvents.Kind.ASSIGNED, null, userId));
        }
    }

    void setPriorityInternal(User actor, KpiTask task, KpiTaskPriority priority) {
        kpiLinks.assertWritable(task, false);
        if (priority == null || priority == task.getPriority()) return;
        log(task, actor, KpiTaskEventAction.PRIORITY_CHANGED, task.getPriority().name(), priority.name());
        task.setPriority(priority);
        taskRepository.saveAndFlush(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), actor.getId(), TaskEvents.Kind.UPDATED));
    }

    /** Đặt / xoá hạn (giữ giờ hạn); việc lặp không xoá hạn được. */
    void setDueInternal(User actor, KpiTask task, LocalDate due) {
        kpiLinks.assertWritable(task, false);
        if (Objects.equals(due, task.getDueDate())) return;
        if (due == null && task.getRecurrence() != null) throw new BusinessException(ErrorCode.TASK_RECURRENCE_NEEDS_DUE);
        checkStartBeforeDue(task.getStartDate(), due);
        log(task, actor, KpiTaskEventAction.DUE_CHANGED, dueText(task.getDueDate(), task.getDueTime()),
                dueText(due, due == null ? null : task.getDueTime()));
        task.setDueDate(due);
        if (due == null) task.setDueTime(null);
        task.setRemindedOverdueAt(null);
        taskRepository.saveAndFlush(task);
        reminderPlanner.recompute(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), actor.getId(), TaskEvents.Kind.DUE_CHANGED));
    }

    void setStartInternal(User actor, KpiTask task, LocalDate start) {
        kpiLinks.assertWritable(task, false);
        if (Objects.equals(start, task.getStartDate())) return;
        checkStartBeforeDue(start, task.getDueDate());
        log(task, actor, KpiTaskEventAction.START_CHANGED, dueText(task.getStartDate(), task.getStartTime()), dueText(start, null));
        task.setStartDate(start);
        if (start == null) task.setStartTime(null);
        taskRepository.saveAndFlush(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), actor.getId(), TaskEvents.Kind.UPDATED));
    }

    // ══ Trường tuỳ chỉnh (dùng chung với TaskListService) ════════════════════════════════════════

    /** Ghi một giá trị trường tuỳ chỉnh (trường phải thuộc {@code listId} và việc gốc phải nằm trong danh sách). */
    void writeFieldValue(User me, KpiTask task, UUID listId, UUID fieldId, Object raw) {
        TaskListField field = fieldRepository.findById(fieldId).filter(f -> f.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_FIELD_NOT_FOUND));
        String json = TaskFieldCodec.encode(field, raw, uid -> userRoleOrgUnitRepository.findByUserId(uid).stream()
                .anyMatch(a -> task.getOrganizationId().equals(PermissionChecker.organizationIdOf(a.getOrgUnit()))));
        TaskFieldValue.Key key = new TaskFieldValue.Key(task.getId(), fieldId);
        if (json == null) {
            fieldValueRepository.findById(key).ifPresent(fieldValueRepository::delete);
        } else {
            TaskFieldValue v = fieldValueRepository.findById(key).orElse(TaskFieldValue.builder().taskId(task.getId()).fieldId(fieldId).build());
            v.setValue(json);
            v.setUpdatedBy(me.getId());
            v.setUpdatedAt(Instant.now());
            fieldValueRepository.save(v);
        }
    }

    // ══ Tiện ích ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Nạp task để GHI: phải sửa được ({@link KpiTaskAccess}), khớp version (nếu có), và {@link TaskKpiLinks#assertWritable}
     * (KPI còn ⇒ kỳ chưa khoá; KPI đã xoá ⇒ chỉ khi {@code allowDeletedKpi}; không KPI ⇒ tự do).
     */
    KpiTask editable(User me, UUID taskId, Long version, boolean allowDeletedKpi) {
        KpiTask task = findTask(taskId);
        if (!access.canEdit(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task)
                    ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (version != null && !version.equals(task.getVersion())) {
            throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        }
        kpiLinks.assertWritable(task, allowDeletedKpi);
        return task;
    }

    /**
     * Kiểm danh sách người thực hiện theo trạng thái KPI và trả về {@link User} theo đúng thứ tự (người đầu là người
     * chính). Có KPI: mọi người là người tạo / thực hiện của KPI và mình được giao cho họ (việc con: sai KPI báo
     * TASK_SUBTASK_OWNER_INVALID). Không KPI: cùng tổ chức, có trang Công việc.
     */
    List<User> validateAssignees(User me, TaskKpiLinks.Link link, UUID orgId, List<UUID> ids, boolean subtask) {
        return validateAssignees(me, link, orgId, ids, subtask, Set.of());
    }

    /**
     * Như trên; {@code alreadyAssigned}: người đang thực hiện sẵn (không đổi KPI) — vẫn kiểm "thuộc KPI" nhưng không đòi
     * người làm phải được giao cho họ (người khác đã giao từ trước).
     */
    List<User> validateAssignees(User me, TaskKpiLinks.Link link, UUID orgId, List<UUID> ids, boolean subtask,
                                 Set<UUID> alreadyAssigned) {
        if (ids == null || ids.isEmpty()) throw new BusinessException(ErrorCode.TASK_ASSIGNEES_REQUIRED);
        if (ids.size() > 1 && !multiAssignee) throw new BusinessException(ErrorCode.TASK_MULTI_ASSIGNEE_DISABLED);
        if (ids.size() > MAX_ASSIGNEES) throw new BusinessException(ErrorCode.TASK_TOO_MANY_ASSIGNEES, MAX_ASSIGNEES);
        Map<UUID, User> users = userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        List<User> out = new ArrayList<>();
        for (UUID id : ids) {
            User u = users.get(id);
            if (u == null) throw new BusinessException(ErrorCode.TASK_ASSIGN_NOT_ALLOWED, "?");
            boolean self = id.equals(me.getId());
            if (link.active()) {
                KpiCriteria kpi = link.kpi();
                if (!KpiTaskAccess.isKpiOf(id, kpi)) {
                    if (subtask) throw new BusinessException(ErrorCode.TASK_SUBTASK_OWNER_INVALID, kpi.getName());
                    if (self) throw new ForbiddenException(ErrorCode.TASK_KPI_NOT_OWNED);
                    throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);
                }
                if (!self && !alreadyAssigned.contains(id) && !access.canAssign(me.getId(), id, kpi)) {
                    throw new ForbiddenException(ErrorCode.TASK_ASSIGN_NOT_ALLOWED, u.getFullName());
                }
            } else if (!alreadyAssigned.contains(id) && !access.canAssignWithoutKpi(me.getId(), id, orgId)) {
                throw new BusinessException(ErrorCode.TASK_ASSIGNEE_NOT_IN_ORG, u.getFullName());
            }
            out.add(u);
        }
        return out;
    }

    /** Ghi danh sách người thực hiện (giữ phần đã tích của người còn lại); người đầu là người chính. */
    void writeAssignees(User me, KpiTask task, List<User> users) {
        Map<UUID, KpiTaskAssignee> current = assigneeRepository.findByTaskIdOrderByAddedAtAsc(task.getId()).stream()
                .collect(Collectors.toMap(KpiTaskAssignee::getUserId, Function.identity()));
        Set<UUID> keep = users.stream().map(User::getId).collect(Collectors.toSet());
        for (KpiTaskAssignee a : current.values()) if (!keep.contains(a.getUserId())) assigneeRepository.delete(a);
        for (User u : users) {
            if (!current.containsKey(u.getId())) {
                assigneeRepository.save(KpiTaskAssignee.builder().taskId(task.getId()).userId(u.getId()).addedBy(me.getId()).build());
                // Người thực hiện không đồng thời là người theo dõi.
                followerRepository.findById(new KpiTaskFollower.Key(task.getId(), u.getId())).ifPresent(followerRepository::delete);
            }
        }
        task.setOwner(users.get(0));
    }

    /** Người theo dõi hợp lệ: việc có KPI ⇒ xem được KPI; không KPI ⇒ cùng tổ chức; KPI đã xoá ⇒ không thêm được. */
    private void assertFollowerAllowed(UUID userId, TaskKpiLinks.Link link, UUID orgId) {
        boolean ok = switch (link.state()) {
            case ACTIVE -> kpiAccessPolicy.canView(userId, link.kpi());
            case NONE -> userRoleOrgUnitRepository.findByUserId(userId).stream()
                    .anyMatch(a -> orgId != null && orgId.equals(PermissionChecker.organizationIdOf(a.getOrgUnit())));
            case DELETED -> false;
        };
        if (!ok) {
            String name = userRepository.findById(userId).map(User::getFullName).orElse(String.valueOf(userId));
            throw new ForbiddenException(ErrorCode.TASK_FOLLOWER_NOT_ALLOWED, name);
        }
    }

    /** Áp các trường nội dung (tên, mô tả, ưu tiên, phạm vi xem, giờ hạn khi FOLLOWING) — dùng cho lần này và các lần sau. */
    private void applyContent(KpiTask task, UpdateKpiTaskRequest req, User me, boolean logIt) {
        if (req.getTitle() != null) {
            String title = requireTitle(req.getTitle());
            if (logIt && !title.equals(task.getTitle())) log(task, me, KpiTaskEventAction.TITLE_CHANGED, task.getTitle(), title);
            task.setTitle(title);
        }
        if (req.getDescription() != null) task.setDescription(blankToNull(req.getDescription()));
        if (req.getDescriptionDoc() != null) task.setDescriptionDoc(blankToNull(req.getDescriptionDoc()));
        if (req.getPriority() != null && req.getPriority() != task.getPriority()) {
            if (logIt) log(task, me, KpiTaskEventAction.PRIORITY_CHANGED, task.getPriority().name(), req.getPriority().name());
            task.setPriority(req.getPriority());
        }
        // Phạm vi xem chỉ đặt ở việc gốc (việc con theo gốc).
        if (req.getVisibility() != null && req.getVisibility() != task.getVisibility() && task.isRoot()) {
            if (logIt) log(task, me, KpiTaskEventAction.VISIBILITY_CHANGED, task.getVisibility().name(), req.getVisibility().name());
            task.setVisibility(req.getVisibility());
        }
        if (!logIt && req.getDueTime() != null && task.getDueDate() != null) task.setDueTime(req.getDueTime());
        if (logIt && req.getDescription() != null) log(task, me, KpiTaskEventAction.UPDATED, null, null);
    }

    private static boolean touchesTemplate(UpdateKpiTaskRequest req) {
        return req.getTitle() != null || req.getDescription() != null || req.getDescriptionDoc() != null
                || req.getPriority() != null || req.getVisibility() != null || req.getDueTime() != null || req.isClearDueTime();
    }

    private static TaskRecurrence.Template templateOf(KpiTask t) {
        return TaskRecurrence.Template.builder().title(t.getTitle()).description(t.getDescription())
                .descriptionDoc(t.getDescriptionDoc()).priority(t.getPriority().name()).visibility(t.getVisibility().name())
                .dueTime(t.getDueTime()).build();
    }

    /** Bản sao mới — Hibernate chỉ thấy cột JSON đổi khi gán một đối tượng KHÁC. */
    static TaskRecurrence copyRule(TaskRecurrence r) {
        if (r == null) return null;
        return TaskRecurrence.builder().freq(r.getFreq()).interval(r.safeInterval())
                .byWeekday(r.getByWeekday() == null ? null : new ArrayList<>(r.getByWeekday()))
                .byMonthDay(r.getByMonthDay()).bySetPos(r.getBySetPos()).byMonth(r.getByMonth()).count(r.getCount())
                .template(r.getTemplate()).build();
    }

    static void validateRecurrence(TaskRecurrence r, LocalDate due) {
        if (r == null) return;
        if (due == null) throw new BusinessException(ErrorCode.TASK_RECURRENCE_NEEDS_DUE);
        if (r.getFreq() == null || (r.getInterval() != null && (r.getInterval() < 1 || r.getInterval() > 365))) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
        if (r.getByWeekday() != null && r.getByWeekday().stream().anyMatch(d -> d == null || d < 1 || d > 7)) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
        if (r.getByMonthDay() != null && (r.getByMonthDay() < 1 || r.getByMonthDay() > 31)) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
        if (r.getBySetPos() != null && (r.getBySetPos() == 0 || r.getBySetPos() < -1 || r.getBySetPos() > 4
                || r.getByWeekday() == null || r.getByWeekday().size() != 1)) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
        if (r.getByMonth() != null && (r.getByMonth() < 1 || r.getByMonth() > 12)) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
        if (r.getCount() != null && (r.getCount() < 1 || r.getCount() > 1000)) {
            throw new BusinessException(ErrorCode.TASK_RECURRENCE_INVALID);
        }
    }

    private static void checkStartBeforeDue(LocalDate start, LocalDate due) {
        if (start != null && due != null && start.isAfter(due)) throw new BusinessException(ErrorCode.TASK_START_AFTER_DUE);
    }

    private static void checkDescriptionDoc(String doc) {
        if (doc != null && doc.length() > MAX_DESCRIPTION_DOC) throw new BusinessException(ErrorCode.TASK_DESCRIPTION_TOO_LARGE);
    }

    private static TaskSourceRef sanitizeSource(TaskSourceRef s) {
        if (s == null || s.getType() == null) return null;
        String label = s.getLabel() == null ? null : truncate(s.getLabel().strip(), 200);
        return TaskSourceRef.builder().type(s.getType()).id(s.getId()).label(label).build();
    }

    static UUID[] append(UUID[] arr, UUID id) {
        UUID[] base = arr == null ? new UUID[0] : arr;
        UUID[] out = Arrays.copyOf(base, base.length + 1);
        out[base.length] = id;
        return out;
    }

    /**
     * Người cho ô chọn, kèm đơn vị để nhóm. Đơn vị của một người = đơn vị SÂU NHẤT người đó có vai trò (mỗi người còn có
     * một vai trò nhân viên tự sinh ở đơn vị cha — lấy đơn vị cha thì ai cũng rơi vào nhóm cấp trên).
     */
    List<TaskOptionResponse> people(List<UUID> ids, String query) {
        Map<UUID, User> users = userRepository.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, UserRoleOrgUnit> home = new HashMap<>();
        if (!ids.isEmpty()) {
            for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByUserIdInWithUnit(ids)) {
                if (a.getOrgUnit() == null) continue;
                UserRoleOrgUnit cur = home.get(a.getUser().getId());
                int depth = depth(a.getOrgUnit().getPath());
                int curDepth = cur == null ? -1 : depth(cur.getOrgUnit().getPath());
                int rank = a.getRole().getRank() == null ? 99 : a.getRole().getRank();
                int curRank = cur == null || cur.getRole().getRank() == null ? 99 : cur.getRole().getRank();
                if (depth > curDepth || (depth == curDepth && rank < curRank)) home.put(a.getUser().getId(), a);
            }
        }
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return ids.stream().map(users::get).filter(Objects::nonNull)
                .filter(u -> q.isEmpty() || u.getFullName().toLowerCase(Locale.ROOT).contains(q)
                        || (u.getEmail() != null && u.getEmail().toLowerCase(Locale.ROOT).contains(q)))
                .map(u -> {
                    UserRoleOrgUnit a = home.get(u.getId());
                    return TaskOptionResponse.builder().id(u.getId()).name(u.getFullName()).secondary(u.getEmail())
                            .avatarUrl(u.getAvatarUrl())
                            .detail(a != null ? a.getRole().getName() : null)
                            .groupId(a != null ? a.getOrgUnit().getId() : null)
                            .groupName(a != null ? a.getOrgUnit().getName() : null)
                            .groupCurrent(true)
                            .groupSort(a != null ? a.getOrgUnit().getPath() : "")
                            .build();
                })
                .toList();
    }

    private static int depth(String path) {
        return path == null ? 0 : (int) path.chars().filter(c -> c == '/').count();
    }

    UUID organizationOf(User me) {
        return userRoleOrgUnitRepository.findByUserId(me.getId()).stream()
                .map(a -> PermissionChecker.organizationIdOf(a.getOrgUnit())).filter(Objects::nonNull).findFirst().orElse(null);
    }

    void requireOwnPermission(User me) {
        if (!permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_OWN)) {
            throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
    }

    KpiTask findTask(UUID id) {
        return taskRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND));
    }

    private KpiTaskChecklistItem checklistItem(UUID taskId, UUID itemId) {
        return checklistRepository.findById(itemId).filter(i -> i.getTaskId().equals(taskId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_CHECKLIST_ITEM_NOT_FOUND));
    }

    void log(KpiTask task, User actor, KpiTaskEventAction action, String oldValue, String newValue) {
        eventRepository.save(KpiTaskEvent.builder().taskId(task.getId()).actorId(actor.getId()).action(action)
                .oldValue(oldValue).newValue(newValue).build());
    }

    private static String dueText(LocalDate d, LocalTime t) {
        if (d == null) return null;
        return t == null ? d.toString() : d + " " + t;
    }

    static void addIfUuid(Set<UUID> out, String v) {
        if (v == null || v.length() != 36) return;
        try {
            out.add(UUID.fromString(v));
        } catch (IllegalArgumentException ignored) {
            // không phải id người
        }
    }

    static String nameOr(Map<UUID, String> names, String v) {
        if (v == null || v.length() != 36) return v;
        try {
            return names.getOrDefault(UUID.fromString(v), v);
        } catch (IllegalArgumentException e) {
            return v;
        }
    }

    private static UUID uuid(Object o) {
        return o instanceof UUID u ? u : UUID.fromString(o.toString());
    }

    private static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    static String requireTitle(String title) {
        if (title == null || title.isBlank()) throw new BusinessException(ErrorCode.TASK_TITLE_REQUIRED);
        return truncate(title.strip(), 255);
    }

    static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }
}
