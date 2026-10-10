package com.kpitracking.service.task;

import com.kpitracking.dto.request.task.*;
import com.kpitracking.dto.response.PageResponse;
import com.kpitracking.dto.response.task.*;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.TaskEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.exception.ResourceNotFoundException;
import com.kpitracking.exception.StaleStateException;
import com.kpitracking.i18n.Terms;
import com.kpitracking.mapper.KpiTaskMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.CloudinaryStorageService;
import com.kpitracking.service.discussion.AttachmentLibrarySources;
import com.kpitracking.service.discussion.CollabAttachmentPolicy;
import com.kpitracking.service.discussion.DiscussionService;
import com.kpitracking.service.kpi.CycleStatusGuard;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Công việc gắn KPI kiểu Lark Tasks: giao việc + người theo dõi, việc con 1 cấp, lặp lại, hạn có giờ, nhắc theo task,
 * mô tả có định dạng. Chỉ để theo dõi, không đổi kết quả KPI.
 *
 * <p>Luật giữ nguyên từ bản đầu: task bắt buộc gắn MỘT KPI — KPI của người phụ trách (người đó tạo hoặc thực hiện), ở
 * trạng thái còn nhận việc ({@link #TASKABLE}); kỳ đã khoá ⇒ mọi thao tác ghi bị chặn qua {@link CycleStatusGuard}; KPI
 * đã xoá ⇒ chỉ chuyển KPI hoặc xoá; sửa có {@code version}. Vai trò và quyền: {@link KpiTaskAccess}.
 */
@Service
@RequiredArgsConstructor
public class KpiTaskService {

    /** Trạng thái KPI cho phép tạo / chuyển task tới. */
    public static final Set<KpiStatus> TASKABLE = EnumSet.of(KpiStatus.DRAFT, KpiStatus.PENDING_APPROVAL,
            KpiStatus.EDIT, KpiStatus.EDITED, KpiStatus.APPROVED, KpiStatus.REJECTED);
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGE = 500;
    private static final int MAX_DESCRIPTION_DOC = 200_000;
    private static final List<KpiTaskStatus> ALL_STATUSES = List.of(KpiTaskStatus.values());
    private static final Set<String> VIEWS = Set.of("ASSIGNED", "FOLLOWING", "CREATED", "DELEGATED", "INVOLVED", "TEAM", "DONE", "ALL");

    private final KpiTaskRepository taskRepository;
    private final KpiTaskChecklistItemRepository checklistRepository;
    private final KpiTaskAttachmentRepository attachmentRepository;
    private final KpiTaskEventRepository eventRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskReminderRepository reminderRepository;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final KpiTaskAccess access;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final PermissionChecker permissionChecker;
    private final CycleStatusGuard cycleStatusGuard;
    private final CollabAttachmentPolicy attachmentPolicy;
    private final AttachmentLibrarySources librarySources;
    private final CloudinaryStorageService storage;
    private final DiscussionService discussionService;
    private final KpiTaskReminderPlanner reminderPlanner;
    private final KpiTaskMapper mapper;
    private final ApplicationEventPublisher events;

    public static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Ngày làm việc cuối tuần (nhóm "Tuần này" khi kéo thả dùng phía giao diện; ở đây chỉ để phân nhóm hạn). */
    public static LocalDate endOfWeek(LocalDate d) {
        return d.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
    }

    // ══ Đọc ══════════════════════════════════════════════════════════════════════════════════════

    /** Tham số danh sách: chế độ xem + bộ lọc + sắp xếp. */
    public record ListQuery(String view, UUID kpiId, UUID periodId, UUID ownerId, List<KpiTaskStatus> statuses,
                            KpiTaskPriority priority, String due, LocalDate dueFrom, LocalDate dueTo, String keyword,
                            String sort, boolean topLevel, int page, int size) {}

    /**
     * Danh sách theo chế độ xem (cột trái): ASSIGNED, FOLLOWING, CREATED, DELEGATED, ALL, DONE, TEAM. {@code due}:
     * OVERDUE | TODAY | TOMORROW | WEEK | LATER | NONE. {@code dueFrom/dueTo}: khoảng ngày (chế độ Lịch).
     */
    @Transactional(readOnly = true)
    public PageResponse<KpiTaskResponse> list(ListQuery q) {
        User me = currentUser();
        requireOwnPermission(me);
        String view = q.view() == null ? "ASSIGNED" : q.view().toUpperCase(Locale.ROOT);
        if (!VIEWS.contains(view)) view = "ASSIGNED";
        List<KpiTaskStatus> statuses = q.statuses() == null || q.statuses().isEmpty() ? ALL_STATUSES : q.statuses();
        if ("DONE".equals(view)) {
            statuses = List.of(KpiTaskStatus.DONE);
            view = "INVOLVED";
        } else if ("ALL".equals(view)) {
            view = "INVOLVED";
        }
        List<UUID> managerUnits = List.of(new UUID(0, 0));
        if ("TEAM".equals(view)) {
            if (!permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM)) {
                throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
            }
            managerUnits = kpiAccessPolicy.viewer(me.getId(), null).managerUnitIdsForQuery();
        }
        return page(me, view, false, managerUnits, statuses, q);
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
        return page(me, "KPI", team, List.of(new UUID(0, 0)), ALL_STATUSES, q).getContent();
    }

    private PageResponse<KpiTaskResponse> page(User me, String view, boolean team, List<UUID> managerUnits,
                                               List<KpiTaskStatus> statuses, ListQuery q) {
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
        Page<KpiTask> result = taskRepository.findView(view, me.getId(), team, managerUnits, statuses,
                q.kpiId(), q.periodId(), q.ownerId(), q.priority(), q.topLevel(), noDue, from, to, overdue,
                today, LocalTime.now(ZONE).withNano(0),
                q.keyword() == null || q.keyword().isBlank() ? null : q.keyword().trim(),
                PageRequest.of(Math.max(q.page(), 0), Math.min(Math.max(q.size(), 1), MAX_PAGE), sortOf(q.sort())));
        List<KpiTask> content = result.getContent();
        if ("priority".equalsIgnoreCase(q.sort())) {
            content = content.stream().sorted(Comparator.comparingInt((KpiTask t) -> switch (t.getPriority()) {
                case HIGH -> 0;
                case MEDIUM -> 1;
                case LOW -> 2;
            })).toList();
        }
        return PageResponse.<KpiTaskResponse>builder()
                .content(toResponses(me, content, false))
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    private static Sort sortOf(String sort) {
        String s = sort == null ? "due" : sort.toLowerCase(Locale.ROOT);
        return switch (s) {
            case "manual" -> Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("createdAt"));
            case "created" -> Sort.by(Sort.Order.desc("createdAt"));
            // Ưu tiên: truy vấn theo hạn rồi xếp lại trong {@link #page} (Spring Data gắn bí danh vào biểu thức CASE
            // của JpaSort.unsafe và sinh JPQL sai). Trang tối đa 500 việc nên xếp trong bộ nhớ không đáng kể.
            case "priority" -> Sort.by(Sort.Order.asc("dueDate").nullsLast(), Sort.Order.asc("sortOrder"));
            default -> Sort.by(Sort.Order.asc("dueDate").nullsLast(), Sort.Order.asc("dueTime").nullsLast(),
                    Sort.Order.asc("sortOrder"));
        };
    }

    @Transactional(readOnly = true)
    public KpiTaskResponse get(UUID taskId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        return detail(me, task);
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
            KpiTaskEventResponse r = mapper.toEventResponse(e);
            r.setActorName(names.get(e.getActorId()));
            // Giao việc / người theo dõi lưu id người — trả tên để hiển thị.
            r.setOldValue(nameOr(names, e.getOldValue()));
            r.setNewValue(nameOr(names, e.getNewValue()));
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
            int open = taskRepository.findOpenByOwnerAndKpi(me.getId(), old.getId()).size();
            if (open > 0) {
                out.add(TaskReplacementResponse.builder().oldKpiId(old.getId()).oldKpiName(old.getName())
                        .newKpiId(newKpiId).newKpiName(newKpi.getName()).openTaskCount(open).build());
            }
        }
        return out;
    }

    /** Cột trái: số việc chưa xong theo chế độ xem, theo KPI của đợt đang diễn ra, huy hiệu. */
    @Transactional(readOnly = true)
    public TaskSidebarResponse sidebar() {
        User me = currentUser();
        Object[] c = taskRepository.viewCounts(me.getId()).stream().findFirst().orElse(new Object[]{0, 0, 0, 0, 0});
        List<TaskSidebarResponse.KpiCount> kpis = taskRepository.myCurrentKpis(me.getId(), Instant.now()).stream()
                .map(r -> TaskSidebarResponse.KpiCount.builder().kpiId(uuid(r[0])).kpiName((String) r[1]).open(num(r[2])).build())
                .toList();
        return TaskSidebarResponse.builder()
                .assigned(num(c[0])).following(num(c[1])).created(num(c[2])).delegated(num(c[3])).all(num(c[4]))
                .canViewTeam(permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM))
                .canAssign(permissionChecker.hasPermission(me.getId(), KpiTaskAccess.ASSIGN))
                .badge(taskRepository.badgeCount(me.getId(), today()))
                .kpis(kpis)
                .build();
    }

    @Transactional(readOnly = true)
    public long badge() {
        return taskRepository.badgeCount(currentUser().getId(), today());
    }

    /** Ô chọn người phụ trách: chính mình + (có TASK:ASSIGN) người trong đơn vị mình quản lý. */
    @Transactional(readOnly = true)
    public List<TaskOptionResponse> assignableUsers(String query) {
        User me = currentUser();
        List<UUID> ids = new ArrayList<>();
        ids.add(me.getId());
        if (permissionChecker.hasPermission(me.getId(), KpiTaskAccess.ASSIGN)) {
            UUID orgId = organizationOf(me);
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
                .filter(k -> access.canAssign(me.getId(), owner, k) && !isLocked(k))
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

    /** Ô thêm người theo dõi: chỉ người xem được KPI của task. */
    @Transactional(readOnly = true)
    public List<TaskOptionResponse> followerCandidates(UUID taskId, String query) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        List<UUID> ids = kpiAccessPolicy.viewerIds(task.getKpiCriteriaId(), KpiTaskAccess.VIEW_OWN, blankToNull(query), 30);
        Set<UUID> existing = new HashSet<>(followerRepository.findUserIds(taskId));
        return people(ids.stream().filter(id -> !id.equals(task.getOwner().getId()) && !existing.contains(id)).toList(), null);
    }

    // ══ Ghi ══════════════════════════════════════════════════════════════════════════════════════

    @Transactional
    public KpiTaskResponse create(CreateKpiTaskRequest req) {
        User me = currentUser();
        requireOwnPermission(me);
        String title = requireTitle(req.getTitle());
        KpiTask parent = null;
        KpiCriteria kpi;
        if (req.getParentTaskId() != null) {
            parent = editable(me, req.getParentTaskId(), null, false);
            if (parent.getParentTaskId() != null) throw new BusinessException(ErrorCode.TASK_SUBTASK_NESTED);
            kpi = kpiCriteriaRepository.findById(parent.getKpiCriteriaId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY));
        } else {
            if (req.getKpiId() == null) throw new BusinessException(ErrorCode.TASK_KPI_REQUIRED);
            kpi = kpiCriteriaRepository.findById(req.getKpiId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.TASK_KPI_REQUIRED));
        }
        User owner = req.getOwnerId() == null || req.getOwnerId().equals(me.getId()) ? me
                : userRepository.findById(req.getOwnerId()).orElseThrow(() -> new BusinessException(ErrorCode.TASK_ASSIGN_NOT_ALLOWED, "?"));
        assertAssignable(me, owner, kpi, parent != null);
        if (!TASKABLE.contains(kpi.getStatus())) {
            throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, kpi.getStatus().name());
        }
        cycleStatusGuard.assertWritable(kpi);
        validateRecurrence(req.getRecurrence(), req.getDueDate());
        checkDescriptionDoc(req.getDescriptionDoc());

        KpiTask task = taskRepository.save(KpiTask.builder()
                .organizationId(KpiAccessPolicy.organizationIdOf(kpi))
                .kpiCriteriaId(kpi.getId())
                .parentTaskId(parent != null ? parent.getId() : null)
                .title(title)
                .description(blankToNull(req.getDescription()))
                .descriptionDoc(blankToNull(req.getDescriptionDoc()))
                .dueDate(req.getDueDate())
                .dueTime(req.getDueDate() != null ? req.getDueTime() : null)
                .priority(req.getPriority() != null ? req.getPriority() : KpiTaskPriority.MEDIUM)
                .visibility(parent != null ? parent.getVisibility()
                        : req.getVisibility() != null ? req.getVisibility() : KpiTaskVisibility.KPI_SCOPE)
                .status(KpiTaskStatus.TODO)
                .owner(owner)
                .createdBy(me.getId())
                .sortOrder(taskRepository.maxSortOrder(owner.getId(), KpiTaskStatus.TODO) + 1)
                .recurrence(copyRule(req.getRecurrence()))
                .recurrenceEndDate(req.getRecurrence() != null ? req.getRecurrenceEndDate() : null)
                .build());
        if (task.getRecurrence() != null) {
            task.setSeriesId(task.getId());
            task.setSeriesIndex(1);
            // Ghi ngay để version trong phản hồi khớp DB (lần sửa kế tiếp của client mang đúng version).
            task = taskRepository.saveAndFlush(task);
        }
        if (req.getChecklist() != null) {
            int i = 0;
            for (String step : req.getChecklist()) {
                if (step == null || step.isBlank()) continue;
                checklistRepository.save(KpiTaskChecklistItem.builder().taskId(task.getId())
                        .title(truncate(step.strip(), 500)).sortOrder(i++).build());
            }
        }
        if (req.getFollowerIds() != null) {
            for (UUID f : new LinkedHashSet<>(req.getFollowerIds())) {
                if (f == null || f.equals(owner.getId())) continue;
                assertFollowerAllowed(f, kpi);
                followerRepository.save(KpiTaskFollower.builder().taskId(task.getId()).userId(f).addedBy(me.getId()).build());
            }
        }
        reminderPlanner.replace(task, req.getReminders());
        log(task, me, KpiTaskEventAction.CREATED, null, null);
        if (!owner.getId().equals(me.getId())) log(task, me, KpiTaskEventAction.ASSIGNED, null, owner.getId().toString());
        if (parent != null) log(parent, me, KpiTaskEventAction.SUBTASK_ADDED, null, task.getTitle());

        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.CREATED));
        if (!owner.getId().equals(me.getId())) {
            events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, null, null));
        }
        if (parent != null) events.publishEvent(TaskEvents.Changed.of(parent.getId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        if (req.getFollowerIds() != null) {
            UUID createdId = task.getId();
            followerRepository.findUserIds(createdId).forEach(f -> events.publishEvent(
                    new TaskEvents.Changed(createdId, me.getId(), TaskEvents.Kind.FOLLOWER_ADDED, null, f)));
        }
        return detail(me, task);
    }

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
        applyContent(task, req, me, true);

        // Hạn.
        LocalDate newDue = req.isClearDueDate() ? null : (req.getDueDate() != null ? req.getDueDate() : task.getDueDate());
        LocalTime newTime = newDue == null || req.isClearDueTime() ? null : (req.getDueTime() != null ? req.getDueTime() : task.getDueTime());
        boolean dueChanged = !Objects.equals(newDue, oldDue) || !Objects.equals(newTime, oldTime);
        if (dueChanged) {
            if (newDue == null && task.getRecurrence() != null && !req.isClearRecurrence()) {
                throw new BusinessException(ErrorCode.TASK_RECURRENCE_NEEDS_DUE);
            }
            log(task, me, KpiTaskEventAction.DUE_CHANGED, dueText(oldDue, oldTime), dueText(newDue, newTime));
            task.setDueDate(newDue);
            task.setDueTime(newTime);
            task.setRemindedOverdueAt(null);
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
        if (dueChanged) reminderPlanner.recompute(task);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(),
                dueChanged ? TaskEvents.Kind.DUE_CHANGED : TaskEvents.Kind.UPDATED));
        return detail(me, task);
    }

    /** Hoàn thành / đổi trạng thái. Còn việc con chưa xong ⇒ 409 TASK_PARENT_HAS_OPEN_SUBTASKS trừ khi {@code force}. */
    @Transactional
    public KpiTaskResponse changeStatus(UUID taskId, ChangeKpiTaskStatusRequest req) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, req.getVersion(), false);
        KpiTaskStatus old = task.getStatus();
        if (req.getStatus() == KpiTaskStatus.DONE && old != KpiTaskStatus.DONE && !req.isForce()) {
            long open = taskRepository.countOpenSubtasks(task.getId());
            if (open > 0) throw new StaleStateException(ErrorCode.TASK_PARENT_HAS_OPEN_SUBTASKS, open);
        }
        if (old != req.getStatus()) {
            task.setStatus(req.getStatus());
            task.setCompletedAt(req.getStatus() == KpiTaskStatus.DONE ? Instant.now() : null);
            log(task, me, KpiTaskEventAction.STATUS_CHANGED, old.name(), req.getStatus().name());
        }
        task.setSortOrder(req.getSortOrder() != null ? req.getSortOrder()
                : (old != req.getStatus() ? taskRepository.maxSortOrder(task.getOwner().getId(), req.getStatus()) + 1 : task.getSortOrder()));
        task = taskRepository.saveAndFlush(task);
        if (req.getStatus() == KpiTaskStatus.DONE && old != KpiTaskStatus.DONE && task.getRecurrence() != null) {
            spawnNext(task, me);
            taskRepository.flush();
        }
        if (old != req.getStatus()) {
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(),
                    req.getStatus() == KpiTaskStatus.DONE ? TaskEvents.Kind.COMPLETED : TaskEvents.Kind.STATUS_CHANGED));
            if (task.getParentTaskId() != null) {
                events.publishEvent(TaskEvents.Changed.of(task.getParentTaskId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
            }
        }
        return toResponses(me, List.of(task), false).get(0);
    }

    /**
     * Giao / giao lại. KPI phải là KPI của người mới; việc con luôn ở KPI của việc cha. Việc cha đổi KPI thì việc con đi
     * theo — người phụ trách việc con nào không thuộc KPI mới thì chặn.
     */
    @Transactional
    public KpiTaskResponse assign(UUID taskId, AssignKpiTaskRequest req) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canReassign(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (!req.getVersion().equals(task.getVersion())) throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        kpiCriteriaRepository.findById(task.getKpiCriteriaId()).ifPresent(cycleStatusGuard::assertWritable);

        User newOwner = userRepository.findById(req.getOwnerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_ASSIGN_NOT_ALLOWED, "?"));
        UUID targetKpiId = task.getParentTaskId() != null ? task.getKpiCriteriaId()
                : req.getKpiId() != null ? req.getKpiId() : task.getKpiCriteriaId();
        if (task.getParentTaskId() != null && req.getKpiId() != null && !req.getKpiId().equals(task.getKpiCriteriaId())) {
            throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);
        }
        KpiCriteria kpi = kpiCriteriaRepository.findById(targetKpiId)
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH));
        assertAssignable(me, newOwner, kpi, task.getParentTaskId() != null);
        if (!TASKABLE.contains(kpi.getStatus())) throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, kpi.getStatus().name());
        cycleStatusGuard.assertWritable(kpi);

        boolean kpiChanged = !kpi.getId().equals(task.getKpiCriteriaId());
        if (kpiChanged) {
            for (KpiTask sub : taskRepository.findSubtasks(task.getId())) {
                if (!KpiTaskAccess.isKpiOf(sub.getOwner().getId(), kpi)) {
                    throw new BusinessException(ErrorCode.TASK_SUBTASK_OWNER_INVALID, kpi.getName());
                }
                sub.setKpiCriteriaId(kpi.getId());
                sub.setOrganizationId(KpiAccessPolicy.organizationIdOf(kpi));
                taskRepository.save(sub);
            }
            log(task, me, KpiTaskEventAction.KPI_MOVED, task.getKpiCriteriaId().toString(), kpi.getId().toString());
            task.setKpiCriteriaId(kpi.getId());
            task.setOrganizationId(KpiAccessPolicy.organizationIdOf(kpi));
            task.setKpiNameSnapshot(null);
        }
        UUID previousOwner = task.getOwner().getId();
        boolean ownerChanged = !previousOwner.equals(newOwner.getId());
        if (ownerChanged) {
            log(task, me, KpiTaskEventAction.REASSIGNED, previousOwner.toString(), newOwner.getId().toString());
            task.setOwner(newOwner);
            followerRepository.deleteById(new KpiTaskFollower.Key(task.getId(), newOwner.getId()));
        }
        task = taskRepository.saveAndFlush(task);
        if (ownerChanged) {
            events.publishEvent(new TaskEvents.Changed(task.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, previousOwner, null));
        } else if (kpiChanged) {
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.UPDATED));
        }
        return detail(me, task);
    }

    /** Thêm người theo dõi: người sửa được task thêm bất kỳ ai xem được KPI; người xem được task tự theo dõi được. */
    @Transactional
    public KpiTaskResponse addFollower(UUID taskId, UUID userId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        boolean self = userId.equals(me.getId());
        if (!(access.canEdit(me.getId(), task) || (self && access.canView(me.getId(), task)))) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        KpiCriteria kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY));
        cycleStatusGuard.assertWritable(kpi);
        if (userId.equals(task.getOwner().getId())) return detail(me, task);
        assertFollowerAllowed(userId, kpi);
        if (!followerRepository.existsByTaskIdAndUserId(taskId, userId)) {
            followerRepository.save(KpiTaskFollower.builder().taskId(taskId).userId(userId).addedBy(me.getId()).build());
            log(task, me, KpiTaskEventAction.FOLLOWER_ADDED, null, userId.toString());
            events.publishEvent(new TaskEvents.Changed(taskId, me.getId(), TaskEvents.Kind.FOLLOWER_ADDED, null, userId));
        }
        return detail(me, task);
    }

    @Transactional
    public KpiTaskResponse removeFollower(UUID taskId, UUID userId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        boolean self = userId.equals(me.getId());
        if (!(access.canEdit(me.getId(), task) || (self && access.isFollower(me.getId(), task)))) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        kpiCriteriaRepository.findById(task.getKpiCriteriaId()).ifPresent(cycleStatusGuard::assertWritable);
        if (followerRepository.existsByTaskIdAndUserId(taskId, userId)) {
            followerRepository.deleteById(new KpiTaskFollower.Key(taskId, userId));
            log(task, me, KpiTaskEventAction.FOLLOWER_REMOVED, userId.toString(), null);
            events.publishEvent(new TaskEvents.Changed(taskId, me.getId(), TaskEvents.Kind.FOLLOWER_REMOVED, null, userId));
        }
        return self && !access.canView(me.getId(), task) ? null : detail(me, task);
    }

    @Transactional
    public KpiTaskResponse setReminders(UUID taskId, List<KpiTaskReminderInput> reminders) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        reminderPlanner.replace(task, reminders == null ? List.of() : reminders);
        log(task, me, KpiTaskEventAction.REMINDERS_CHANGED, null, String.valueOf(reminders == null ? 0 : reminders.size()));
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.REMINDERS_CHANGED));
        return detail(me, task);
    }

    /** Nhân bản: cùng KPI, cùng người phụ trách (nếu mình còn được giao cho người đó), checklist bỏ tích, người theo dõi, nhắc. */
    @Transactional
    public KpiTaskResponse duplicate(UUID taskId) {
        User me = currentUser();
        KpiTask src = editable(me, taskId, null, false);
        KpiCriteria kpi = kpiCriteriaRepository.findById(src.getKpiCriteriaId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY));
        User owner = access.canAssign(me.getId(), src.getOwner().getId(), kpi) ? src.getOwner() : me;
        assertAssignable(me, owner, kpi, src.getParentTaskId() != null);
        KpiTask copy = taskRepository.save(KpiTask.builder()
                .organizationId(src.getOrganizationId()).kpiCriteriaId(src.getKpiCriteriaId()).parentTaskId(src.getParentTaskId())
                .title(src.getTitle()).description(src.getDescription()).descriptionDoc(src.getDescriptionDoc())
                .dueDate(src.getDueDate()).dueTime(src.getDueTime()).priority(src.getPriority()).visibility(src.getVisibility())
                .status(KpiTaskStatus.TODO).owner(owner).createdBy(me.getId())
                .sortOrder(taskRepository.maxSortOrder(owner.getId(), KpiTaskStatus.TODO) + 1)
                .build());
        copyChildren(src, copy, me);
        log(copy, me, KpiTaskEventAction.DUPLICATED, src.getId().toString(), null);
        events.publishEvent(TaskEvents.Changed.of(copy.getId(), me.getId(), TaskEvents.Kind.CREATED));
        if (!owner.getId().equals(me.getId())) {
            events.publishEvent(new TaskEvents.Changed(copy.getId(), me.getId(), TaskEvents.Kind.ASSIGNED, null, null));
        }
        return detail(me, copy);
    }

    /** Xoá (mềm) — chỉ người tạo; việc con đi theo. */
    @Transactional
    public void delete(UUID taskId) {
        User me = currentUser();
        KpiTask task = findTask(taskId);
        if (!access.canDelete(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task) ? ErrorCode.TASK_DELETE_NOT_CREATOR : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        kpiCriteriaRepository.findById(task.getKpiCriteriaId()).ifPresent(cycleStatusGuard::assertWritable);
        Instant now = Instant.now();
        for (KpiTask sub : taskRepository.findSubtasks(task.getId())) {
            sub.setDeletedAt(now);
            taskRepository.save(sub);
        }
        task.setDeletedAt(now);
        taskRepository.save(task);
        log(task, me, KpiTaskEventAction.DELETED, null, null);
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.DELETED));
        if (task.getParentTaskId() != null) {
            events.publishEvent(TaskEvents.Changed.of(task.getParentTaskId(), me.getId(), TaskEvents.Kind.SUBTASKS_CHANGED));
        }
    }

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
        return detail(me, task);
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
        return detail(me, task);
    }

    @Transactional
    public KpiTaskResponse deleteChecklistItem(UUID taskId, UUID itemId) {
        User me = currentUser();
        KpiTask task = editable(me, taskId, null, false);
        checklistRepository.delete(checklistItem(taskId, itemId));
        events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.CHECKLIST_CHANGED));
        return detail(me, task);
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
            return detail(ctx.me(), ctx.task());
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
        return detail(me, task);
    }

    /** Chuyển việc của người gọi sang KPI khác (KPI cũ được thay / đã xoá). Việc con đi theo việc cha. */
    @Transactional
    public int move(MoveKpiTasksRequest req) {
        User me = currentUser();
        if (req.getFromKpiId().equals(req.getToKpiId())) throw new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID);
        KpiCriteria to = kpiCriteriaRepository.findById(req.getToKpiId())
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_MOVE_TARGET_INVALID));
        if (!KpiTaskAccess.isKpiOf(me.getId(), to)) throw new ForbiddenException(ErrorCode.TASK_KPI_NOT_OWNED);
        if (!TASKABLE.contains(to.getStatus())) throw new BusinessException(ErrorCode.TASK_KPI_STATUS_NOT_ALLOWED, to.getStatus().name());
        cycleStatusGuard.assertWritable(to);
        // KPI nguồn đã khoá kỳ thì task của nó chỉ đọc — không chuyển đi được. KPI nguồn đã xoá thì không cần kiểm.
        kpiCriteriaRepository.findById(req.getFromKpiId()).ifPresent(cycleStatusGuard::assertWritable);

        List<KpiTask> tasks = req.getTaskIds() == null || req.getTaskIds().isEmpty()
                ? taskRepository.findOpenByOwnerAndKpi(me.getId(), req.getFromKpiId()).stream()
                        .filter(t -> t.getParentTaskId() == null).toList()
                : taskRepository.findAllById(req.getTaskIds()).stream()
                        .filter(t -> t.getKpiCriteriaId().equals(req.getFromKpiId())).toList();
        for (KpiTask t : tasks) {
            if (!access.canEdit(me.getId(), t)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_EDIT);
            log(t, me, KpiTaskEventAction.KPI_MOVED, t.getKpiCriteriaId().toString(), to.getId().toString());
            moveTo(t, to);
            for (KpiTask sub : taskRepository.findSubtasks(t.getId())) moveTo(sub, to);
            events.publishEvent(TaskEvents.Changed.of(t.getId(), me.getId(), TaskEvents.Kind.UPDATED));
        }
        return tasks.size();
    }

    private void moveTo(KpiTask t, KpiCriteria to) {
        t.setKpiCriteriaId(to.getId());
        t.setOrganizationId(KpiAccessPolicy.organizationIdOf(to));
        t.setKpiNameSnapshot(null);
        taskRepository.save(t);
    }

    // ══ Lặp lại ══════════════════════════════════════════════════════════════════════════════════

    /**
     * Hoàn thành một lần của việc lặp ⇒ tạo lần kế tiếp (hạn tính từ hạn cũ). Không tạo khi: quá ngày kết thúc, vượt
     * ngày kết thúc của đợt KPI, KPI không còn nhận việc, kỳ đã khoá, hoặc lần kế tiếp đã có (hoàn thành lại sau khi mở
     * lại không nhân đôi).
     */
    void spawnNext(KpiTask task, User actor) {
        TaskRecurrence rule = task.getRecurrence();
        if (rule == null || task.getDueDate() == null) return;
        LocalDate next = rule.next(task.getDueDate());
        if (task.getRecurrenceEndDate() != null && next.isAfter(task.getRecurrenceEndDate())) return;
        KpiCriteria kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId()).orElse(null);
        if (kpi == null || !TASKABLE.contains(kpi.getStatus())) return;
        KpiPeriod period = kpi.getKpiPeriod();
        if (period != null && period.getEndDate() != null && next.isAfter(LocalDate.ofInstant(period.getEndDate(), ZONE))) return;
        if (period != null && period.getKpiCycle() != null && cycleStatusGuard.isLocked(period.getKpiCycle().getId())) return;

        UUID seriesId = task.getSeriesId() != null ? task.getSeriesId() : task.getId();
        int index = (task.getSeriesIndex() != null ? task.getSeriesIndex() : 1) + 1;
        if (taskRepository.existsBySeriesIdAndSeriesIndex(seriesId, index)) return;
        if (task.getSeriesId() == null) {
            task.setSeriesId(seriesId);
            task.setSeriesIndex(1);
            taskRepository.save(task);
        }

        TaskRecurrence.Template tpl = rule.getTemplate();
        KpiTask nextTask = taskRepository.save(KpiTask.builder()
                .organizationId(task.getOrganizationId())
                .kpiCriteriaId(task.getKpiCriteriaId())
                .parentTaskId(task.getParentTaskId())
                .title(tpl != null && tpl.getTitle() != null ? tpl.getTitle() : task.getTitle())
                .description(tpl != null && tpl.getDescription() != null ? tpl.getDescription() : task.getDescription())
                .descriptionDoc(tpl != null && tpl.getDescriptionDoc() != null ? tpl.getDescriptionDoc() : task.getDescriptionDoc())
                .priority(tpl != null && tpl.getPriority() != null ? KpiTaskPriority.valueOf(tpl.getPriority()) : task.getPriority())
                .visibility(tpl != null && tpl.getVisibility() != null ? KpiTaskVisibility.valueOf(tpl.getVisibility()) : task.getVisibility())
                .dueDate(next)
                .dueTime(tpl != null && tpl.getDueTime() != null ? tpl.getDueTime() : task.getDueTime())
                .status(KpiTaskStatus.TODO)
                .owner(task.getOwner())
                .createdBy(task.getCreatedBy())
                .sortOrder(taskRepository.maxSortOrder(task.getOwner().getId(), KpiTaskStatus.TODO) + 1)
                .recurrence(copyRule(rule))
                .recurrenceEndDate(task.getRecurrenceEndDate())
                .seriesId(seriesId)
                .seriesIndex(index)
                .build());
        copyChildren(task, nextTask, actor);
        log(nextTask, actor, KpiTaskEventAction.RECURRED, task.getId().toString(), String.valueOf(index));
        events.publishEvent(TaskEvents.Changed.of(nextTask.getId(), actor.getId(), TaskEvents.Kind.CREATED));
    }

    /** Chép checklist (bỏ tích), người theo dõi, mốc nhắc — không chép việc con, tệp, bình luận. */
    private void copyChildren(KpiTask from, KpiTask to, User actor) {
        for (KpiTaskChecklistItem item : checklistRepository.findByTaskIdOrderBySortOrderAscCreatedAtAsc(from.getId())) {
            checklistRepository.save(KpiTaskChecklistItem.builder().taskId(to.getId()).title(item.getTitle())
                    .done(false).sortOrder(item.getSortOrder()).build());
        }
        for (KpiTaskFollower f : followerRepository.findByTaskId(from.getId())) {
            if (f.getUserId().equals(to.getOwner().getId())) continue;
            followerRepository.save(KpiTaskFollower.builder().taskId(to.getId()).userId(f.getUserId()).addedBy(actor.getId()).build());
        }
        reminderPlanner.copy(from, to);
    }

    // ══ Ghép phản hồi ════════════════════════════════════════════════════════════════════════════

    private KpiTaskResponse detail(User me, KpiTask task) {
        KpiTaskResponse r = toResponses(me, List.of(task), true).get(0);
        if (task.getParentTaskId() == null) {
            r.setSubtasks(toResponses(me, taskRepository.findSubtasks(task.getId()), false));
        }
        return r;
    }

    private List<KpiTaskResponse> toResponses(User me, List<KpiTask> tasks, boolean detail) {
        if (tasks.isEmpty()) return new ArrayList<>();
        Set<UUID> kpiIds = tasks.stream().map(KpiTask::getKpiCriteriaId).collect(Collectors.toSet());
        Map<UUID, KpiCriteria> kpis = kpiCriteriaRepository.findAllById(kpiIds).stream()
                .collect(Collectors.toMap(KpiCriteria::getId, Function.identity()));
        List<UUID> ids = tasks.stream().map(KpiTask::getId).toList();
        Map<UUID, KpiTask> parents = taskRepository.findAllById(tasks.stream().map(KpiTask::getParentTaskId)
                        .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        Map<UUID, List<KpiTaskChecklistItem>> checklist = checklistRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskChecklistItem::getTaskId));
        Map<UUID, List<KpiTaskAttachment>> files = attachmentRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskAttachment::getTaskId));
        // Chỉ bản chi tiết có danh sách tệp; tài liệu gốc thuộc cùng tổ chức với công việc.
        AttachmentLibrarySources.Viewer library = librarySources.viewer(!detail ? List.of()
                        : files.values().stream().flatMap(List::stream).map(KpiTaskAttachment::getSourceDocumentId).toList(),
                me.getId(), tasks.get(0).getOrganizationId());
        Map<UUID, List<KpiTaskFollower>> followers = followerRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskFollower::getTaskId));
        Map<UUID, List<KpiTaskReminder>> reminders = detail ? reminderRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskReminder::getTaskId)) : Map.of();
        Map<UUID, long[]> subProgress = new HashMap<>();
        for (Object[] row : taskRepository.subtaskProgress(ids)) subProgress.put(uuid(row[0]), new long[]{num(row[1]), num(row[2])});
        Map<UUID, Long> comments = discussionService.commentCounts(DiscussionTargetType.TASK, ids);
        Map<UUID, Long> unread = discussionService.unreadCounts(me.getId(), DiscussionTargetType.TASK, ids);
        Set<UUID> personIds = new HashSet<>();
        tasks.forEach(t -> { if (t.getCreatedBy() != null) personIds.add(t.getCreatedBy()); });
        followers.values().forEach(l -> l.forEach(f -> personIds.add(f.getUserId())));
        Map<UUID, User> persons = userRepository.findAllById(personIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        LocalDate today = today();
        LocalTime nowTime = LocalTime.now(ZONE);

        return tasks.stream().map(t -> {
            KpiTaskResponse r = mapper.toResponse(t);
            KpiCriteria kpi = kpis.get(t.getKpiCriteriaId());
            r.setKpiDeleted(kpi == null);
            r.setKpiName(kpi != null ? kpi.getName() : t.getKpiNameSnapshot());
            if (kpi != null) {
                r.setKpiStatus(kpi.getStatus());
                if (kpi.getKpiPeriod() != null) {
                    r.setKpiPeriodId(kpi.getKpiPeriod().getId());
                    r.setKpiPeriodName(kpi.getKpiPeriod().getName());
                }
            }
            boolean open = t.getStatus() == KpiTaskStatus.TODO || t.getStatus() == KpiTaskStatus.IN_PROGRESS;
            boolean past = t.getDueDate() != null && (t.getDueDate().isBefore(today)
                    || (t.getDueDate().isEqual(today) && t.getDueTime() != null && t.getDueTime().isBefore(nowTime)));
            r.setOverdue(open && past);
            r.setDueToday(t.getDueDate() != null && t.getDueDate().isEqual(today));
            r.setDueBucket(bucketOf(t, open && past, today));
            if (t.getParentTaskId() != null && parents.containsKey(t.getParentTaskId())) {
                r.setParentTitle(parents.get(t.getParentTaskId()).getTitle());
            }
            User creator = persons.get(t.getCreatedBy());
            r.setCreatedByName(creator != null ? creator.getFullName() : null);
            List<KpiTaskChecklistItem> items = checklist.getOrDefault(t.getId(), List.of());
            r.setChecklistTotal(items.size());
            r.setChecklistDone((int) items.stream().filter(KpiTaskChecklistItem::getDone).count());
            long[] sp = subProgress.getOrDefault(t.getId(), new long[]{0, 0});
            r.setSubtaskDone((int) sp[0]);
            r.setSubtaskTotal((int) sp[1]);
            r.setAttachmentCount(files.getOrDefault(t.getId(), List.of()).size());
            r.setCommentCount(comments.getOrDefault(t.getId(), 0L));
            r.setUnreadComments(unread.getOrDefault(t.getId(), 0L));
            List<KpiTaskFollower> fl = followers.getOrDefault(t.getId(), List.of());
            r.setFollowers(fl.stream().map(f -> persons.get(f.getUserId())).filter(Objects::nonNull)
                    .map(u -> KpiTaskResponse.Person.builder().id(u.getId()).fullName(u.getFullName()).avatarUrl(u.getAvatarUrl()).build())
                    .toList());
            r.setFollowing(fl.stream().anyMatch(f -> f.getUserId().equals(me.getId())));

            KpiTask parent = parents.get(t.getParentTaskId());
            boolean editor = access.isOwner(me.getId(), t) || access.isCreator(me.getId(), t)
                    || (parent != null && (access.isOwner(me.getId(), parent) || access.isCreator(me.getId(), parent)));
            boolean locked = kpi != null && isLocked(kpi);
            KpiTaskResponse.ReadOnlyReason reason = !editor ? KpiTaskResponse.ReadOnlyReason.NOT_OWNER
                    : kpi == null ? KpiTaskResponse.ReadOnlyReason.KPI_DELETED
                    : locked ? KpiTaskResponse.ReadOnlyReason.CYCLE_LOCKED : null;
            r.setReadOnlyReason(reason);
            r.setCanEdit(reason == null);
            boolean reassigner = access.isCreator(me.getId(), t)
                    || (parent != null && (access.isOwner(me.getId(), parent) || access.isCreator(me.getId(), parent)));
            r.setCanReassign(reassigner && kpi != null && !locked);
            r.setCanDelete(access.isCreator(me.getId(), t) && !locked);
            r.setCanManageFollowers(reason == null);
            if (detail) {
                r.setChecklist(items.stream()
                        .sorted(Comparator.comparing(KpiTaskChecklistItem::getSortOrder).thenComparing(KpiTaskChecklistItem::getCreatedAt))
                        .map(mapper::toChecklistItem).toList());
                r.setAttachments(files.getOrDefault(t.getId(), List.of()).stream().map(a -> {
                    KpiTaskResponse.Attachment ar = mapper.toAttachment(a);
                    Document src = library.openable(a.getSourceDocumentId());
                    if (src != null) {
                        ar.setSourceDocumentId(src.getId());
                        ar.setSourceDocumentTitle(src.getTitle());
                    }
                    return ar;
                }).toList());
                r.setReminders(reminders.getOrDefault(t.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(KpiTaskReminder::getCreatedAt)).map(mapper::toReminder).toList());
            }
            return r;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    private static KpiTaskResponse.DueBucket bucketOf(KpiTask t, boolean overdue, LocalDate today) {
        if (t.getDueDate() == null) return KpiTaskResponse.DueBucket.NONE;
        if (overdue || t.getDueDate().isBefore(today)) return KpiTaskResponse.DueBucket.OVERDUE;
        if (t.getDueDate().isEqual(today)) return KpiTaskResponse.DueBucket.TODAY;
        if (t.getDueDate().isEqual(today.plusDays(1))) return KpiTaskResponse.DueBucket.TOMORROW;
        if (!t.getDueDate().isAfter(endOfWeek(today))) return KpiTaskResponse.DueBucket.THIS_WEEK;
        return KpiTaskResponse.DueBucket.LATER;
    }

    /** Chỉ để HIỂN THỊ (không khoá hàng); thao tác ghi luôn đi qua {@link CycleStatusGuard}. */
    private static boolean isLocked(KpiCriteria kpi) {
        if (kpi.getStatus() == KpiStatus.CLOSED_BY_LOCK) return true;
        KpiPeriod p = kpi.getKpiPeriod();
        if (p == null) return false;
        if (p.getStatus() != null && p.getStatus().isTerminal()) return true;
        return p.getKpiCycle() != null && p.getKpiCycle().getStatus() == KpiCycleStatus.LOCKED;
    }

    // ══ Tiện ích ═════════════════════════════════════════════════════════════════════════════════

    /**
     * Nạp task để GHI: phải sửa được ({@link KpiTaskAccess#canEdit}), khớp version (nếu có), KPI còn và kỳ chưa khoá.
     * {@code allowDeletedKpi}: thao tác vẫn được khi KPI đã xoá.
     */
    private KpiTask editable(User me, UUID taskId, Long version, boolean allowDeletedKpi) {
        KpiTask task = findTask(taskId);
        if (!access.canEdit(me.getId(), task)) {
            throw new ForbiddenException(access.canView(me.getId(), task)
                    ? ErrorCode.TASK_NO_PERMISSION_EDIT : ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
        if (version != null && !version.equals(task.getVersion())) {
            throw new StaleStateException(ErrorCode.TASK_VERSION_CONFLICT);
        }
        Optional<KpiCriteria> kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId());
        if (kpi.isEmpty()) {
            if (!allowDeletedKpi) throw new BusinessException(ErrorCode.TASK_KPI_DELETED_READONLY);
        } else {
            cycleStatusGuard.assertWritable(kpi.get());
        }
        return task;
    }

    /**
     * Người phụ trách phải thuộc KPI (tạo / thực hiện), và người gọi phải được giao cho người đó. Việc con: sai KPI báo
     * TASK_SUBTASK_OWNER_INVALID; việc thường tự giao cho mình báo TASK_KPI_NOT_OWNED như bản đầu.
     */
    private void assertAssignable(User me, User owner, KpiCriteria kpi, boolean subtask) {
        boolean self = owner.getId().equals(me.getId());
        if (!KpiTaskAccess.isKpiOf(owner.getId(), kpi)) {
            if (subtask) throw new BusinessException(ErrorCode.TASK_SUBTASK_OWNER_INVALID, kpi.getName());
            if (self) throw new ForbiddenException(ErrorCode.TASK_KPI_NOT_OWNED);
            throw new BusinessException(ErrorCode.TASK_ASSIGNEE_KPI_MISMATCH);
        }
        if (!self && !access.canAssign(me.getId(), owner.getId(), kpi)) {
            throw new ForbiddenException(ErrorCode.TASK_ASSIGN_NOT_ALLOWED, owner.getFullName());
        }
    }

    private void assertFollowerAllowed(UUID userId, KpiCriteria kpi) {
        if (!kpiAccessPolicy.canView(userId, kpi)) {
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
        if (req.getVisibility() != null && req.getVisibility() != task.getVisibility()) {
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
    private static TaskRecurrence copyRule(TaskRecurrence r) {
        if (r == null) return null;
        return TaskRecurrence.builder().freq(r.getFreq()).interval(r.safeInterval())
                .byWeekday(r.getByWeekday() == null ? null : new ArrayList<>(r.getByWeekday()))
                .byMonthDay(r.getByMonthDay()).template(r.getTemplate()).build();
    }

    private static void validateRecurrence(TaskRecurrence r, LocalDate due) {
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
    }

    private static void checkDescriptionDoc(String doc) {
        if (doc != null && doc.length() > MAX_DESCRIPTION_DOC) throw new BusinessException(ErrorCode.TASK_DESCRIPTION_TOO_LARGE);
    }

    /**
     * Người cho ô chọn, kèm đơn vị để nhóm. Đơn vị của một người = đơn vị SÂU NHẤT người đó có vai trò (mỗi người còn có
     * một vai trò nhân viên tự sinh ở đơn vị cha — lấy đơn vị cha thì ai cũng rơi vào nhóm cấp trên).
     */
    private List<TaskOptionResponse> people(List<UUID> ids, String query) {
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

    private UUID organizationOf(User me) {
        return userRoleOrgUnitRepository.findByUserId(me.getId()).stream()
                .map(a -> PermissionChecker.organizationIdOf(a.getOrgUnit())).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private void requireOwnPermission(User me) {
        if (!permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_OWN)) {
            throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        }
    }

    private KpiTask findTask(UUID id) {
        return taskRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.TASK_NOT_FOUND));
    }

    private KpiTaskChecklistItem checklistItem(UUID taskId, UUID itemId) {
        return checklistRepository.findById(itemId).filter(i -> i.getTaskId().equals(taskId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_CHECKLIST_ITEM_NOT_FOUND));
    }

    private void log(KpiTask task, User actor, KpiTaskEventAction action, String oldValue, String newValue) {
        eventRepository.save(KpiTaskEvent.builder().taskId(task.getId()).actorId(actor.getId()).action(action)
                .oldValue(oldValue).newValue(newValue).build());
    }

    private static String dueText(LocalDate d, LocalTime t) {
        if (d == null) return null;
        return t == null ? d.toString() : d + " " + t;
    }

    private static void addIfUuid(Set<UUID> out, String v) {
        if (v == null || v.length() != 36) return;
        try {
            out.add(UUID.fromString(v));
        } catch (IllegalArgumentException ignored) {
            // không phải id người
        }
    }

    private static String nameOr(Map<UUID, String> names, String v) {
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

    private static String requireTitle(String title) {
        if (title == null || title.isBlank()) throw new BusinessException(ErrorCode.TASK_TITLE_REQUIRED);
        return truncate(title.strip(), 255);
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException(Terms.of("resource.user"), "email", email));
    }
}
