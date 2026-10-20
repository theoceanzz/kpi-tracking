package com.kpitracking.service.task;

import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.entity.*;
import com.kpitracking.enums.DiscussionTargetType;
import com.kpitracking.enums.KpiCycleStatus;
import com.kpitracking.enums.KpiStatus;
import com.kpitracking.enums.KpiTaskStatus;
import com.kpitracking.enums.TaskListRole;
import com.kpitracking.mapper.KpiTaskMapper;
import com.kpitracking.repository.*;
import com.kpitracking.service.discussion.AttachmentLibrarySources;
import com.kpitracking.service.discussion.DiscussionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Dựng {@link KpiTaskResponse} cho một trang việc: nạp theo LÔ (người thực hiện, người theo dõi, danh sách, nhãn, trường,
 * phụ thuộc, bình luận) rồi ghép — không truy vấn theo từng việc. Quyền / lý do chỉ đọc lấy từ {@link KpiTaskAccess.Scope}.
 */
@Component
@RequiredArgsConstructor
public class TaskResponseAssembler {

    private final KpiTaskRepository taskRepository;
    private final KpiTaskChecklistItemRepository checklistRepository;
    private final KpiTaskAttachmentRepository attachmentRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final KpiTaskReminderRepository reminderRepository;
    private final UserRepository userRepository;
    private final TaskListRepository listRepository;
    private final TaskListItemRepository listItemRepository;
    private final TaskListSectionRepository sectionRepository;
    private final TaskListFieldRepository fieldRepository;
    private final TaskFieldValueRepository fieldValueRepository;
    private final TaskTagLinkRepository tagLinkRepository;
    private final TaskMySectionItemRepository mySectionItemRepository;
    private final TaskTagRepository tagRepository;
    private final TaskDependencyRepository dependencyRepository;
    private final TaskListAccess listAccess;
    private final KpiTaskAccess access;
    private final AttachmentLibrarySources librarySources;
    private final DiscussionService discussionService;
    private final KpiTaskMapper mapper;

    public KpiTaskResponse detail(User me, KpiTask task) {
        KpiTaskResponse r = toResponses(me, List.of(task), true).get(0);
        r.setSubtasks(toResponses(me, taskRepository.findSubtasks(task.getId()), false));
        r.setDependencies(dependencies(me, task));
        return r;
    }

    public List<KpiTaskResponse> toResponses(User me, List<KpiTask> tasks, boolean detail) {
        if (tasks.isEmpty()) return new ArrayList<>();
        KpiTaskAccess.Scope scope = access.scope(me.getId(), tasks);
        List<UUID> ids = tasks.stream().map(KpiTask::getId).toList();
        Map<UUID, KpiTask> parents = taskRepository.findAllById(tasks.stream().map(KpiTask::getParentTaskId)
                        .filter(Objects::nonNull).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        Map<UUID, List<KpiTaskChecklistItem>> checklist = checklistRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskChecklistItem::getTaskId));
        Map<UUID, List<KpiTaskAttachment>> files = attachmentRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskAttachment::getTaskId));
        AttachmentLibrarySources.Viewer library = librarySources.viewer(!detail ? List.of()
                        : files.values().stream().flatMap(List::stream).map(KpiTaskAttachment::getSourceDocumentId).toList(),
                me.getId(), tasks.get(0).getOrganizationId());
        Map<UUID, List<KpiTaskFollower>> followers = followerRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskFollower::getTaskId));
        Map<UUID, List<KpiTaskAssignee>> assignees = assigneeRepository.findByTaskIdIn(ids).stream()
                .sorted(Comparator.comparing(KpiTaskAssignee::getAddedAt))
                .collect(Collectors.groupingBy(KpiTaskAssignee::getTaskId));
        Map<UUID, List<KpiTaskReminder>> reminders = detail ? reminderRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(KpiTaskReminder::getTaskId)) : Map.of();
        Map<UUID, long[]> subProgress = new HashMap<>();
        for (Object[] row : taskRepository.subtaskProgress(ids)) subProgress.put(uuid(row[0]), new long[]{num(row[1]), num(row[2])});
        Map<UUID, Long> blockers = new HashMap<>();
        for (Object[] row : dependencyRepository.openBlockerCounts(ids)) blockers.put(uuid(row[0]), num(row[1]));
        Map<UUID, List<UUID>> blockedBy = dependencyRepository.touching(ids).stream()
                .collect(Collectors.groupingBy(TaskDependency::getSuccessorId,
                        Collectors.mapping(TaskDependency::getPredecessorId, Collectors.toList())));
        Map<UUID, Long> comments = discussionService.commentCounts(DiscussionTargetType.TASK, ids);
        Map<UUID, Long> unread = discussionService.unreadCounts(me.getId(), DiscussionTargetType.TASK, ids);

        // Danh sách (của việc gốc), nhóm, trường — chỉ danh sách người xem là thành viên.
        Set<UUID> roots = tasks.stream().map(KpiTask::rootId).collect(Collectors.toSet());
        List<TaskListItem> items = listItemRepository.findByTaskIdIn(roots);
        Set<UUID> listIds = items.stream().map(TaskListItem::getListId).collect(Collectors.toSet());
        Map<UUID, TaskListRole> myRoles = listAccess.rolesOf(me.getId(), listIds);
        Map<UUID, TaskList> lists = myRoles.isEmpty() ? Map.of() : listRepository.findAllById(myRoles.keySet()).stream()
                .collect(Collectors.toMap(TaskList::getId, Function.identity()));
        Map<UUID, TaskListSection> sections = lists.isEmpty() ? Map.of() : sectionRepository.findByListIdIn(lists.keySet()).stream()
                .collect(Collectors.toMap(TaskListSection::getId, Function.identity()));
        Map<UUID, List<TaskListItem>> itemsByRoot = items.stream().filter(i -> lists.containsKey(i.getListId()))
                .collect(Collectors.groupingBy(TaskListItem::getTaskId));
        Map<UUID, TaskListField> fields = lists.isEmpty() ? Map.of() : fieldRepository.findByListIdIn(lists.keySet()).stream()
                .collect(Collectors.toMap(TaskListField::getId, Function.identity()));
        Map<UUID, List<TaskFieldValue>> values = fields.isEmpty() ? Map.of() : fieldValueRepository.findByTaskIdIn(ids).stream()
                .filter(v -> fields.containsKey(v.getFieldId()))
                .collect(Collectors.groupingBy(TaskFieldValue::getTaskId));

        Map<UUID, UUID> mySections = mySectionItemRepository.findByUserIdAndTaskIdIn(me.getId(), ids).stream()
                .collect(Collectors.toMap(TaskMySectionItem::getTaskId, TaskMySectionItem::getSectionId));
        Map<UUID, List<TaskTagLink>> tagLinks = tagLinkRepository.findByTaskIdIn(ids).stream()
                .collect(Collectors.groupingBy(TaskTagLink::getTaskId));
        Set<UUID> tagIds = tagLinks.values().stream().flatMap(List::stream).map(TaskTagLink::getTagId).collect(Collectors.toSet());
        Map<UUID, TaskTag> tags = tagIds.isEmpty() ? Map.of() : tagRepository.findAllById(tagIds).stream()
                .collect(Collectors.toMap(TaskTag::getId, Function.identity()));

        Set<UUID> personIds = new HashSet<>();
        tasks.forEach(t -> { if (t.getCreatedBy() != null) personIds.add(t.getCreatedBy()); });
        followers.values().forEach(l -> l.forEach(f -> personIds.add(f.getUserId())));
        assignees.values().forEach(l -> l.forEach(a -> personIds.add(a.getUserId())));
        if (detail) files.values().forEach(l -> l.forEach(a -> personIds.add(a.getUploadedBy())));
        Map<UUID, User> persons = userRepository.findAllById(personIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        LocalDate today = KpiTaskService.today();
        LocalTime nowTime = LocalTime.now(KpiTaskService.ZONE);

        return tasks.stream().map(t -> {
            KpiTaskResponse r = mapper.toResponse(t);
            TaskKpiLinks.Link link = scope.link(t);
            KpiCriteria kpi = link.kpi();
            r.setKpiState(link.state().name());
            r.setKpiDeleted(link.deleted());
            r.setKpiName(kpi != null ? kpi.getName() : link.deleted() ? t.getKpiNameSnapshot() : null);
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
            List<KpiTaskChecklistItem> its = checklist.getOrDefault(t.getId(), List.of());
            r.setChecklistTotal(its.size());
            r.setChecklistDone((int) its.stream().filter(KpiTaskChecklistItem::getDone).count());
            long[] sp = subProgress.getOrDefault(t.getId(), new long[]{0, 0});
            r.setSubtaskDone((int) sp[0]);
            r.setSubtaskTotal((int) sp[1]);
            r.setOpenBlockers(blockers.getOrDefault(t.getId(), 0L).intValue());
            r.setBlockedByIds(blockedBy.getOrDefault(t.getId(), List.of()));
            r.setAttachmentCount(files.getOrDefault(t.getId(), List.of()).size());
            r.setCommentCount(comments.getOrDefault(t.getId(), 0L));
            r.setUnreadComments(unread.getOrDefault(t.getId(), 0L));
            List<KpiTaskFollower> fl = followers.getOrDefault(t.getId(), List.of());
            r.setFollowers(fl.stream().map(f -> persons.get(f.getUserId())).filter(Objects::nonNull)
                    .map(u -> KpiTaskResponse.Person.builder().id(u.getId()).fullName(u.getFullName()).avatarUrl(u.getAvatarUrl()).build())
                    .toList());
            r.setFollowing(fl.stream().anyMatch(f -> f.getUserId().equals(me.getId())));

            UUID primary = t.getOwner() != null ? t.getOwner().getId() : null;
            List<KpiTaskAssignee> as = new ArrayList<>(assignees.getOrDefault(t.getId(), List.of()));
            as.sort(Comparator.comparing((KpiTaskAssignee a) -> !a.getUserId().equals(primary)));
            r.setAssignees(as.stream().map(a -> {
                User u = persons.get(a.getUserId());
                return KpiTaskResponse.Assignee.builder().id(a.getUserId()).fullName(u != null ? u.getFullName() : null)
                        .avatarUrl(u != null ? u.getAvatarUrl() : null).primary(a.getUserId().equals(primary))
                        .completedAt(a.getCompletedAt()).build();
            }).toList());
            r.setMyPartDone(as.stream().anyMatch(a -> a.getUserId().equals(me.getId()) && a.getCompletedAt() != null));

            r.setLists(itemsByRoot.getOrDefault(t.rootId(), List.of()).stream().map(i -> {
                TaskList l = lists.get(i.getListId());
                TaskListSection s = i.getSectionId() != null ? sections.get(i.getSectionId()) : null;
                return KpiTaskResponse.ListRef.builder().listId(l.getId()).listName(l.getName()).color(l.getColor())
                        .sectionId(s != null ? s.getId() : null).sectionName(s != null ? s.getName() : null)
                        .sortOrder(i.getSortOrder()).build();
            }).toList());
            r.setMySectionId(mySections.get(t.getId()));
            r.setTags(tagLinks.getOrDefault(t.getId(), List.of()).stream().map(l -> tags.get(l.getTagId())).filter(Objects::nonNull)
                    .sorted(Comparator.comparing(TaskTag::getName, String.CASE_INSENSITIVE_ORDER))
                    .map(g -> KpiTaskResponse.Tag.builder().id(g.getId()).name(g.getName()).color(g.getColor()).build()).toList());
            r.setFieldValues(values.getOrDefault(t.getId(), List.of()).stream().map(v -> KpiTaskResponse.FieldValue.builder()
                    .fieldId(v.getFieldId()).listId(fields.get(v.getFieldId()).getListId())
                    .value(TaskFieldCodec.unwrap(v.getValue())).build()).toList());

            boolean editor = scope.canEdit(t);
            boolean locked = kpi != null && isLocked(kpi);
            KpiTaskResponse.ReadOnlyReason reason = !editor ? KpiTaskResponse.ReadOnlyReason.NOT_OWNER
                    : link.deleted() ? KpiTaskResponse.ReadOnlyReason.KPI_DELETED
                    : locked ? KpiTaskResponse.ReadOnlyReason.CYCLE_LOCKED : null;
            r.setReadOnlyReason(reason);
            r.setCanEdit(reason == null);
            boolean reassigner = scope.canReassign(t);
            r.setCanReassign(reassigner && !link.deleted() && !locked);
            r.setCanSetKpi(reassigner && t.isRoot() && !locked);
            r.setCanDelete(scope.canDelete(t) && !locked);
            r.setCanManageFollowers(reason == null);
            r.setCanDecline(scope.canDecline(t) && open);
            if (detail) {
                r.setChecklist(its.stream()
                        .sorted(Comparator.comparing(KpiTaskChecklistItem::getSortOrder).thenComparing(KpiTaskChecklistItem::getCreatedAt))
                        .map(mapper::toChecklistItem).toList());
                r.setAttachments(files.getOrDefault(t.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(KpiTaskAttachment::getCreatedAt)).map(a -> {
                    KpiTaskResponse.Attachment ar = mapper.toAttachment(a);
                    Document src = library.openable(a.getSourceDocumentId());
                    if (src != null) {
                        ar.setSourceDocumentId(src.getId());
                        ar.setSourceDocumentTitle(src.getTitle());
                    }
                    User uploader = persons.get(a.getUploadedBy());
                    if (uploader != null) {
                        ar.setUploadedByName(uploader.getFullName());
                        ar.setUploadedByAvatarUrl(uploader.getAvatarUrl());
                    }
                    ar.setCanDelete(reason == null && scope.canRemoveFile(t, a.getUploadedBy(), a.getKind()));
                    return ar;
                }).toList());
                r.setReminders(reminders.getOrDefault(t.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(KpiTaskReminder::getCreatedAt)).map(mapper::toReminder).toList());
            }
            return r;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    /** Phụ thuộc của một việc; tên việc bên kia chỉ hiện khi người xem mở được nó. */
    private List<KpiTaskResponse.DependencyRef> dependencies(User me, KpiTask task) {
        List<TaskDependency> deps = dependencyRepository.touching(List.of(task.getId()));
        if (deps.isEmpty()) return List.of();
        Set<UUID> otherIds = deps.stream().map(d -> d.getSuccessorId().equals(task.getId()) ? d.getPredecessorId() : d.getSuccessorId())
                .collect(Collectors.toSet());
        List<KpiTask> others = taskRepository.findAllById(otherIds);
        Map<UUID, KpiTask> byId = others.stream().collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        KpiTaskAccess.Scope scope = access.scope(me.getId(), others);
        List<KpiTaskResponse.DependencyRef> out = new ArrayList<>();
        for (TaskDependency d : deps) {
            boolean blockedBy = d.getSuccessorId().equals(task.getId());
            KpiTask o = byId.get(blockedBy ? d.getPredecessorId() : d.getSuccessorId());
            if (o == null) continue;
            boolean ok = scope.canView(o);
            out.add(KpiTaskResponse.DependencyRef.builder().id(d.getId()).direction(blockedBy ? "BLOCKED_BY" : "BLOCKING")
                    .taskId(o.getId()).title(ok ? o.getTitle() : null).status(o.getStatus())
                    .dueDate(ok ? o.getDueDate() : null).accessible(ok).build());
        }
        return out;
    }

    static KpiTaskResponse.DueBucket bucketOf(KpiTask t, boolean overdue, LocalDate today) {
        if (t.getDueDate() == null) return KpiTaskResponse.DueBucket.NONE;
        if (overdue || t.getDueDate().isBefore(today)) return KpiTaskResponse.DueBucket.OVERDUE;
        if (t.getDueDate().isEqual(today)) return KpiTaskResponse.DueBucket.TODAY;
        if (t.getDueDate().isEqual(today.plusDays(1))) return KpiTaskResponse.DueBucket.TOMORROW;
        if (!t.getDueDate().isAfter(KpiTaskService.endOfWeek(today))) return KpiTaskResponse.DueBucket.THIS_WEEK;
        return KpiTaskResponse.DueBucket.LATER;
    }

    /** Chỉ để HIỂN THỊ (không khoá hàng); thao tác ghi luôn đi qua {@code CycleStatusGuard}. */
    static boolean isLocked(KpiCriteria kpi) {
        if (kpi.getStatus() == KpiStatus.CLOSED_BY_LOCK) return true;
        KpiPeriod p = kpi.getKpiPeriod();
        if (p == null) return false;
        if (p.getStatus() != null && p.getStatus().isTerminal()) return true;
        return p.getKpiCycle() != null && p.getKpiCycle().getStatus() == KpiCycleStatus.LOCKED;
    }

    private static UUID uuid(Object o) {
        return o instanceof UUID u ? u : UUID.fromString(o.toString());
    }

    private static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }
}
