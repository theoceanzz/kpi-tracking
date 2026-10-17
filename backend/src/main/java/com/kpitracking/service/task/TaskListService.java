package com.kpitracking.service.task;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.dto.request.task.CreateKpiTaskRequest;
import com.kpitracking.dto.request.task.TaskListRequests;
import com.kpitracking.dto.response.task.KpiTaskResponse;
import com.kpitracking.dto.response.task.TaskListResponses;
import com.kpitracking.entity.*;
import com.kpitracking.enums.*;
import com.kpitracking.event.TaskEvents;
import com.kpitracking.event.TaskListEvents;
import com.kpitracking.exception.BusinessException;
import com.kpitracking.exception.ErrorCode;
import com.kpitracking.exception.ForbiddenException;
import com.kpitracking.mapper.TaskListMapper;
import com.kpitracking.repository.*;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Danh sách công việc kiểu Lark (docs/TASKS_DESIGN.md §4, §8, §9): thành viên (người / đơn vị), nhóm, việc trong danh
 * sách (nhóm + thứ tự gắn với CẶP việc–danh sách), trường tuỳ chỉnh, chế độ xem đã lưu, mẫu, tự động hoá, thống kê.
 *
 * <p>Vai trò: OWNER sửa danh sách / thành viên / trường / tự động hoá / mẫu / xoá; EDITOR thêm–bớt–kéo việc, sửa giá trị
 * trường; VIEWER xem. Danh sách không cấp quyền gì trên việc gắn KPI / việc riêng tư — xem {@link KpiTaskAccess}.
 */
@Service
@RequiredArgsConstructor
public class TaskListService {

    /** Cấu hình bảng điều khiển do giao diện gửi — chặn cỡ để không ai nhét dữ liệu lớn vào cột này. */
    static final int MAX_DASHBOARD_JSON = 20_000;

    public static final int MAX_FIELDS = 30;
    public static final int MAX_SECTIONS = 50;
    public static final int MAX_VIEWS_PER_USER = 50;
    public static final int MAX_VIEW_CONFIG = 20_000;
    public static final int MAX_AUTOMATIONS = 30;
    private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();

    private final TaskListRepository listRepository;
    private final TaskListMemberRepository memberRepository;
    private final TaskListSectionRepository sectionRepository;
    private final TaskListItemRepository itemRepository;
    private final TaskListUserPrefRepository prefRepository;
    private final TaskListFieldRepository fieldRepository;
    private final TaskFieldValueRepository fieldValueRepository;
    private final TaskSavedViewRepository viewRepository;
    private final TaskListTemplateRepository templateRepository;
    private final TaskListAutomationRepository automationRepository;
    private final KpiTaskRepository taskRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final KpiTaskChecklistItemRepository checklistRepository;
    private final UserRepository userRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final TaskListAccess listAccess;
    private final KpiTaskAccess access;
    private final TaskKpiLinks kpiLinks;
    private final KpiTaskService taskService;
    private final TaskResponseAssembler assembler;
    private final TaskSearch search;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final PermissionChecker permissionChecker;
    private final TaskListMapper mapper;
    private final ApplicationEventPublisher events;

    // ══ Danh sách ════════════════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public TaskListResponses.TaskListDetail get(UUID listId) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        TaskListRole role = listAccess.require(me.getId(), list, TaskListRole.VIEWER);
        return detail(list, role, me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail create(TaskListRequests.Upsert req) {
        User me = taskService.currentUser();
        taskService.requireOwnPermission(me);
        UUID orgId = taskService.organizationOf(me);
        if (orgId == null) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        TaskListTemplates.Payload payload = null;
        String defaultName = null;
        if (req.getTemplateId() != null) {
            TaskListTemplate tpl = templateRepository.findById(req.getTemplateId()).filter(t -> t.getOrganizationId().equals(orgId))
                    .orElseThrow(() -> new BusinessException(ErrorCode.TASK_TEMPLATE_NOT_FOUND));
            payload = readPayload(tpl.getPayload());
            defaultName = tpl.getName();
        } else if (req.getBuiltinTemplate() != null && !req.getBuiltinTemplate().isBlank()) {
            if (!TaskListTemplates.BUILTIN.contains(req.getBuiltinTemplate())) throw new BusinessException(ErrorCode.TASK_TEMPLATE_NOT_FOUND);
            payload = TaskListTemplates.builtin(req.getBuiltinTemplate());
            defaultName = TaskListTemplates.name(req.getBuiltinTemplate());
        }
        String name = req.getName() != null && !req.getName().isBlank() ? req.getName() : defaultName;
        TaskList list = listRepository.save(TaskList.builder().organizationId(orgId).name(requireName(name))
                .description(KpiTaskService.blankToNull(req.getDescription())).color(req.getColor())
                .icon(KpiTaskService.blankToNull(req.getIcon())).createdBy(me.getId()).build());
        memberRepository.save(TaskListMember.builder().listId(list.getId()).userId(me.getId()).role(TaskListRole.OWNER).addedBy(me.getId()).build());
        if (req.getMembers() != null) {
            for (TaskListRequests.Member m : req.getMembers()) {
                if (me.getId().equals(m.getUserId())) continue;
                addMemberInternal(me, list, m);
            }
        }
        if (payload != null) applyTemplate(me, list, payload, req.isIncludeSampleTasks());
        listRepository.flush();
        return detail(list, TaskListRole.OWNER, me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail update(UUID listId, TaskListRequests.Upsert req) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.OWNER);
        if (req.getName() != null) list.setName(requireName(req.getName()));
        if (req.getDescription() != null) list.setDescription(KpiTaskService.blankToNull(req.getDescription()));
        if (req.getColor() != null) list.setColor(req.getColor().isBlank() ? null : req.getColor());
        if (req.getIcon() != null) list.setIcon(KpiTaskService.blankToNull(req.getIcon()));
        list = listRepository.saveAndFlush(list);
        return detail(list, TaskListRole.OWNER, me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail archive(UUID listId, boolean archived) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.OWNER);
        list.setArchivedAt(archived ? Instant.now() : null);
        list = listRepository.saveAndFlush(list);
        return detail(list, TaskListRole.OWNER, me);
    }

    /** Xoá mềm danh sách — việc vẫn còn, chỉ không còn nằm trong danh sách. */
    @Transactional
    public void delete(UUID listId) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.OWNER);
        list.setDeletedAt(Instant.now());
        listRepository.save(list);
    }

    // ══ Thành viên ═══════════════════════════════════════════════════════════════════════════════

    @Transactional
    public TaskListResponses.TaskListDetail addMember(UUID listId, TaskListRequests.Member req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        addMemberInternal(me, list, req);
        return detail(list, TaskListRole.OWNER, me);
    }

    private void addMemberInternal(User me, TaskList list, TaskListRequests.Member req) {
        if ((req.getUserId() == null) == (req.getOrgUnitId() == null) || req.getRole() == null) {
            throw new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID);
        }
        if (req.getUserId() != null) {
            boolean inOrg = userRepository.findById(req.getUserId()).filter(u -> u.getDeletedAt() == null).isPresent()
                    && userRoleOrgUnitRepository.findByUserId(req.getUserId()).stream()
                    .anyMatch(a -> list.getOrganizationId().equals(PermissionChecker.organizationIdOf(a.getOrgUnit())));
            if (!inOrg) throw new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID);
            TaskListMember m = memberRepository.findByListIdAndUserId(list.getId(), req.getUserId())
                    .orElse(TaskListMember.builder().listId(list.getId()).userId(req.getUserId()).addedBy(me.getId()).build());
            boolean fresh = m.getId() == null;
            m.setRole(req.getRole());
            memberRepository.save(m);
            if (fresh && !req.getUserId().equals(me.getId())) {
                events.publishEvent(new TaskListEvents.MemberAdded(list.getId(), req.getUserId(), me.getId()));
            }
        } else {
            OrgUnit unit = orgUnitRepository.findById(req.getOrgUnitId()).orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID));
            if (!list.getOrganizationId().equals(PermissionChecker.organizationIdOf(unit))) throw new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID);
            TaskListMember m = memberRepository.findByListIdAndOrgUnitId(list.getId(), unit.getId())
                    .orElse(TaskListMember.builder().listId(list.getId()).orgUnitId(unit.getId()).addedBy(me.getId()).build());
            m.setRole(req.getRole());
            memberRepository.save(m);
        }
    }

    @Transactional
    public TaskListResponses.TaskListDetail updateMember(UUID listId, UUID memberId, TaskListRequests.Member req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        TaskListMember m = memberRepository.findById(memberId).filter(x -> x.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID));
        if (req.getRole() == null) throw new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID);
        if (m.getRole() == TaskListRole.OWNER && req.getRole() != TaskListRole.OWNER) assertNotLastOwner(list, m);
        m.setRole(req.getRole());
        memberRepository.save(m);
        return detail(list, listAccess.roleOf(me.getId(), listId), me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail removeMember(UUID listId, UUID memberId) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        TaskListMember m = memberRepository.findById(memberId).filter(x -> x.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_MEMBER_INVALID));
        // Tự rời danh sách được; bỏ người khác cần chủ sở hữu.
        if (!me.getId().equals(m.getUserId())) listAccess.require(me.getId(), list, TaskListRole.OWNER);
        if (m.getRole() == TaskListRole.OWNER) assertNotLastOwner(list, m);
        memberRepository.delete(m);
        memberRepository.flush();
        TaskListRole role = listAccess.roleOf(me.getId(), listId);
        return role == null ? null : detail(list, role, me);
    }

    private void assertNotLastOwner(TaskList list, TaskListMember leaving) {
        long owners = memberRepository.findByListIdOrderByAddedAtAsc(list.getId()).stream()
                .filter(x -> x.getRole() == TaskListRole.OWNER && x.getUserId() != null && !x.getId().equals(leaving.getId())).count();
        if (owners == 0) throw new BusinessException(ErrorCode.TASK_LIST_LAST_OWNER);
    }

    // ══ Nhóm ═════════════════════════════════════════════════════════════════════════════════════

    @Transactional
    public TaskListResponses.TaskListDetail addSection(UUID listId, TaskListRequests.Section req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        if (sectionRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId).size() >= MAX_SECTIONS) {
            throw new BusinessException(ErrorCode.TASK_LIST_SECTION_NOT_FOUND);
        }
        sectionRepository.save(TaskListSection.builder().listId(listId).name(requireSectionName(req.getName()))
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : sectionRepository.maxSortOrder(listId) + 1).build());
        return detail(list, listAccess.roleOf(me.getId(), listId), me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail updateSection(UUID listId, UUID sectionId, TaskListRequests.Section req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        TaskListSection s = section(listId, sectionId);
        if (req.getName() != null) s.setName(requireSectionName(req.getName()));
        if (req.getSortOrder() != null) s.setSortOrder(req.getSortOrder());
        sectionRepository.save(s);
        return detail(list, listAccess.roleOf(me.getId(), listId), me);
    }

    /** Xoá nhóm — việc trong nhóm về "Chưa phân nhóm". */
    @Transactional
    public TaskListResponses.TaskListDetail deleteSection(UUID listId, UUID sectionId) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        TaskListSection s = section(listId, sectionId);
        itemRepository.clearSection(s.getId());
        sectionRepository.delete(s);
        return detail(list, listAccess.roleOf(me.getId(), listId), me);
    }

    // ══ Việc trong danh sách ═════════════════════════════════════════════════════════════════════

    /** Thêm một việc gốc (mình xem được, cùng tổ chức) vào danh sách — cần EDITOR. */
    @Transactional
    public KpiTaskResponse addItem(UUID listId, TaskListRequests.Item req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        KpiTask task = taskService.findTask(req.getTaskId());
        if (!task.isRoot()) throw new BusinessException(ErrorCode.TASK_LIST_ONLY_ROOT);
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        if (!task.getOrganizationId().equals(list.getOrganizationId())) throw new BusinessException(ErrorCode.TASK_LIST_ORG_MISMATCH);
        UUID sectionId = req.getSectionId();
        if (sectionId != null) section(listId, sectionId);
        TaskListItem.Key key = new TaskListItem.Key(listId, task.getId());
        if (itemRepository.findById(key).isEmpty()) {
            itemRepository.save(TaskListItem.builder().listId(listId).taskId(task.getId()).sectionId(sectionId)
                    .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : itemRepository.maxSortOrder(listId) + 1)
                    .addedBy(me.getId()).build());
            taskService.log(task, me, KpiTaskEventAction.LIST_ADDED, null, list.getName());
            events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.LISTS_CHANGED));
            events.publishEvent(new TaskListEvents.ItemAdded(listId, task.getId(), me.getId()));
        }
        return assembler.detail(me, task);
    }

    @Transactional
    public void removeItem(UUID listId, UUID taskId) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        KpiTask task = taskService.findTask(taskId);
        if (itemRepository.deleteOne(listId, taskId) > 0) {
            Set<UUID> fieldIds = fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId).stream()
                    .map(TaskListField::getId).collect(Collectors.toSet());
            if (!fieldIds.isEmpty()) fieldValueRepository.deleteByTaskAndFields(taskId, fieldIds);
            taskService.log(task, me, KpiTaskEventAction.LIST_REMOVED, list.getName(), null);
            events.publishEvent(TaskEvents.Changed.of(taskId, me.getId(), TaskEvents.Kind.LISTS_CHANGED));
        }
    }

    /** Kéo việc sang nhóm khác / đổi thứ tự trong danh sách. */
    @Transactional
    public KpiTaskResponse moveItem(UUID listId, TaskListRequests.Item req) {
        User me = taskService.currentUser();
        editableList(me, listId, TaskListRole.EDITOR);
        KpiTask task = taskService.findTask(req.getTaskId());
        if (!access.canView(me.getId(), task)) throw new ForbiddenException(ErrorCode.TASK_NO_PERMISSION_VIEW);
        moveItemInternal(me, listId, task, req.isClearSection() ? null : req.getSectionId(), req.isClearSection() || req.getSectionId() != null,
                req.getSortOrder());
        return assembler.detail(me, task);
    }

    /** Lõi chuyển nhóm (dùng chung với thao tác hàng loạt và tự động hoá). */
    void moveItemInternal(User actor, UUID listId, KpiTask task, UUID sectionId, boolean changeSection, Double sortOrder) {
        TaskListItem item = itemRepository.findById(new TaskListItem.Key(listId, task.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_NOT_FOUND));
        UUID old = item.getSectionId();
        if (changeSection && sectionId != null) section(listId, sectionId);
        if (changeSection) item.setSectionId(sectionId);
        if (sortOrder != null) item.setSortOrder(sortOrder);
        itemRepository.save(item);
        if (changeSection && !Objects.equals(old, sectionId)) {
            String from = old == null ? null : sectionRepository.findById(old).map(TaskListSection::getName).orElse(null);
            String to = sectionId == null ? null : sectionRepository.findById(sectionId).map(TaskListSection::getName).orElse(null);
            taskService.log(task, actor, KpiTaskEventAction.SECTION_CHANGED, from, to);
            events.publishEvent(TaskEvents.Changed.of(task.getId(), actor.getId(), TaskEvents.Kind.SECTION_CHANGED));
            events.publishEvent(new TaskListEvents.SectionChanged(listId, task.getId(), sectionId, actor.getId()));
        }
    }

    // ══ Trường tuỳ chỉnh ═════════════════════════════════════════════════════════════════════════

    @Transactional
    public TaskListResponses.TaskListDetail addField(UUID listId, TaskListRequests.Field req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        if (fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId).size() >= MAX_FIELDS) {
            throw new BusinessException(ErrorCode.TASK_FIELD_INVALID);
        }
        if (req.getType() == null || req.getName() == null || req.getName().isBlank()) throw new BusinessException(ErrorCode.TASK_FIELD_INVALID);
        String options = optionsOf(req);
        fieldRepository.save(TaskListField.builder().listId(listId).name(KpiTaskService.truncate(req.getName().strip(), 120))
                .type(req.getType()).options(options)
                .sortOrder(req.getSortOrder() != null ? req.getSortOrder() : fieldRepository.maxSortOrder(listId) + 1).build());
        return detail(list, TaskListRole.OWNER, me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail updateField(UUID listId, UUID fieldId, TaskListRequests.Field req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        TaskListField f = field(listId, fieldId);
        if (req.getName() != null) {
            if (req.getName().isBlank()) throw new BusinessException(ErrorCode.TASK_FIELD_INVALID);
            f.setName(KpiTaskService.truncate(req.getName().strip(), 120));
        }
        if (req.getOptions() != null) {
            TaskListRequests.Field merged = TaskListRequests.Field.builder().type(f.getType()).options(req.getOptions()).build();
            f.setOptions(optionsOf(merged));
        }
        if (req.getSortOrder() != null) f.setSortOrder(req.getSortOrder());
        fieldRepository.save(f);
        return detail(list, TaskListRole.OWNER, me);
    }

    @Transactional
    public TaskListResponses.TaskListDetail deleteField(UUID listId, UUID fieldId) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        TaskListField f = field(listId, fieldId);
        f.setDeletedAt(Instant.now());
        fieldRepository.save(f);
        return detail(list, TaskListRole.OWNER, me);
    }

    private static String optionsOf(TaskListRequests.Field req) {
        boolean select = req.getType() == TaskFieldType.SINGLE_SELECT || req.getType() == TaskFieldType.MULTI_SELECT;
        if (!select) return null;
        List<TaskFieldCodec.Option> opts = req.getOptions() == null ? List.of() : req.getOptions().stream()
                .map(o -> new TaskFieldCodec.Option(o.getId(), o.getLabel(), o.getColor())).toList();
        String json = TaskFieldCodec.optionsJson(opts);
        if (TaskFieldCodec.options(json).isEmpty()) throw new BusinessException(ErrorCode.TASK_FIELD_INVALID);
        return json;
    }

    /**
     * Đặt giá trị trường tuỳ chỉnh trên một việc: mình là thành viên danh sách của trường, việc gốc nằm trong danh sách đó
     * và mình sửa được việc (việc có KPI: kỳ chưa khoá).
     */
    @Transactional
    public KpiTaskResponse setFieldValue(UUID taskId, UUID fieldId, TaskListRequests.FieldValue req) {
        User me = taskService.currentUser();
        TaskListField field = fieldRepository.findById(fieldId).orElseThrow(() -> new BusinessException(ErrorCode.TASK_FIELD_NOT_FOUND));
        if (listAccess.roleOf(me.getId(), field.getListId()) == null) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_VIEW);
        KpiTask task = taskService.editable(me, taskId, null, false);
        if (itemRepository.findById(new TaskListItem.Key(field.getListId(), task.rootId())).isEmpty()) {
            throw new BusinessException(ErrorCode.TASK_FIELD_NOT_FOUND);
        }
        taskService.writeFieldValue(me, task, field.getListId(), fieldId, req.getValue());
        taskService.log(task, me, KpiTaskEventAction.FIELD_CHANGED, null, field.getName());
        events.publishEvent(TaskEvents.Changed.of(task.getId(), me.getId(), TaskEvents.Kind.FIELD_CHANGED));
        events.publishEvent(new TaskListEvents.FieldChanged(field.getListId(), task.getId(), fieldId, me.getId()));
        return assembler.detail(me, task);
    }

    // ══ Chế độ xem đã lưu ════════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<TaskListResponses.SavedView> views() {
        User me = taskService.currentUser();
        Set<UUID> lists = listAccess.rolesOf(me.getId()).keySet();
        return viewRepository.visibleTo(me.getId(), lists.isEmpty() ? List.of(new UUID(0, 0)) : lists).stream()
                .map(v -> {
                    TaskListResponses.SavedView r = mapper.toSavedView(v);
                    r.setMine(v.getOwnerId().equals(me.getId()));
                    return r;
                }).toList();
    }

    @Transactional
    public TaskListResponses.SavedView createView(TaskListRequests.SavedView req) {
        User me = taskService.currentUser();
        UUID orgId = taskService.organizationOf(me);
        if (viewRepository.countByOwnerId(me.getId()) >= MAX_VIEWS_PER_USER) throw new BusinessException(ErrorCode.TASK_VIEW_INVALID);
        TaskSavedView v = TaskSavedView.builder().organizationId(orgId).ownerId(me.getId()).build();
        applyView(me, v, req, true);
        v = viewRepository.save(v);
        TaskListResponses.SavedView r = mapper.toSavedView(v);
        r.setMine(true);
        return r;
    }

    @Transactional
    public TaskListResponses.SavedView updateView(UUID viewId, TaskListRequests.SavedView req) {
        User me = taskService.currentUser();
        TaskSavedView v = viewRepository.findById(viewId).filter(x -> x.getOwnerId().equals(me.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_VIEW_NOT_FOUND));
        applyView(me, v, req, false);
        v = viewRepository.save(v);
        TaskListResponses.SavedView r = mapper.toSavedView(v);
        r.setMine(true);
        return r;
    }

    @Transactional
    public void deleteView(UUID viewId) {
        User me = taskService.currentUser();
        TaskSavedView v = viewRepository.findById(viewId).filter(x -> x.getOwnerId().equals(me.getId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_VIEW_NOT_FOUND));
        viewRepository.delete(v);
    }

    private void applyView(User me, TaskSavedView v, TaskListRequests.SavedView req, boolean creating) {
        if (req.getName() != null || creating) {
            if (req.getName() == null || req.getName().isBlank()) throw new BusinessException(ErrorCode.TASK_VIEW_INVALID);
            v.setName(KpiTaskService.truncate(req.getName().strip(), 120));
        }
        if (req.getConfig() != null || creating) {
            String json = TaskFieldCodec.write(req.getConfig() == null ? Map.of() : req.getConfig());
            if (json.length() > MAX_VIEW_CONFIG) throw new BusinessException(ErrorCode.TASK_VIEW_INVALID);
            v.setConfig(json);
        }
        if (creating) v.setListId(req.getListId());
        if (v.getListId() != null) {
            TaskListRole role = listAccess.roleOf(me.getId(), v.getListId());
            if (role == null) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_VIEW);
            // Chia sẻ cho cả danh sách: chỉ biên tập trở lên.
            v.setShared(req.isShared() && role.atLeast(TaskListRole.EDITOR));
        } else {
            v.setShared(false);
        }
        if (req.getSortOrder() != null) v.setSortOrder(req.getSortOrder());
    }

    // ══ Mẫu ══════════════════════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<TaskListResponses.Template> templates() {
        User me = taskService.currentUser();
        UUID orgId = taskService.organizationOf(me);
        boolean admin = orgId != null && permissionChecker.isGlobalAdminOfOrganization(me.getId(), orgId);
        List<TaskListResponses.Template> out = new ArrayList<>();
        for (String id : TaskListTemplates.BUILTIN) {
            TaskListTemplates.Payload p = TaskListTemplates.builtin(id);
            out.add(TaskListResponses.Template.builder().id("builtin:" + id).name(TaskListTemplates.name(id))
                    .description(TaskListTemplates.description(id)).builtin(true).sections(p.sections())
                    .fieldCount(p.fields().size()).taskCount(p.tasks().size()).build());
        }
        if (orgId != null) {
            for (TaskListTemplate t : templateRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)) {
                TaskListTemplates.Payload p = readPayload(t.getPayload());
                out.add(TaskListResponses.Template.builder().id(t.getId().toString()).name(t.getName()).description(t.getDescription())
                        .builtin(false).sections(p.sections()).fieldCount(p.fields().size()).taskCount(p.tasks().size())
                        .canDelete(admin || t.getCreatedBy().equals(me.getId())).build());
            }
        }
        return out;
    }

    /** Lưu danh sách thành mẫu của tổ chức (chủ danh sách). Việc chỉ chép việc gốc mình xem được. */
    @Transactional
    public TaskListResponses.Template saveAsTemplate(UUID listId, TaskListRequests.Template req) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.OWNER);
        List<TaskListSection> sections = sectionRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId);
        Map<UUID, String> sectionNames = sections.stream().collect(Collectors.toMap(TaskListSection::getId, TaskListSection::getName));
        List<TaskListField> fields = fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId);
        Map<UUID, TaskListField> fieldById = fields.stream().collect(Collectors.toMap(TaskListField::getId, Function.identity()));
        List<TaskListTemplates.TaskDef> tasks = new ArrayList<>();
        if (req.isIncludeTasks()) {
            LocalDate today = KpiTaskService.today();
            Map<UUID, TaskListItem> items = itemRepository.findByListId(listId).stream()
                    .collect(Collectors.toMap(TaskListItem::getTaskId, Function.identity()));
            List<KpiTask> roots = taskRepository.findAllById(items.keySet());
            KpiTaskAccess.Scope scope = access.scope(me.getId(), roots);
            roots.stream().filter(scope::canView).sorted(Comparator.comparing(t -> items.get(t.getId()).getSortOrder())).limit(200)
                    .forEach(t -> tasks.add(new TaskListTemplates.TaskDef(t.getTitle(),
                            sectionNames.get(items.get(t.getId()).getSectionId()),
                            t.getDueDate() == null ? null : (int) Math.max(0, ChronoUnit.DAYS.between(today, t.getDueDate())),
                            checklistRepository.findByTaskIdOrderBySortOrderAscCreatedAtAsc(t.getId()).stream()
                                    .map(KpiTaskChecklistItem::getTitle).toList(),
                            t.getPriority().name(), t.getRecurrence() != null ? t.getRecurrence().getFreq().name() : null)));
        }
        List<TaskListTemplates.AutomationDef> automations = new ArrayList<>();
        for (TaskListAutomation a : automationRepository.findByListIdOrderByCreatedAtAsc(listId)) {
            Map<String, Object> trigger = new HashMap<>(mapper.map(a.getTrigger()));
            Map<String, Object> action = new HashMap<>(mapper.map(a.getAction()));
            toNames(trigger, sectionNames, fieldById);
            toNames(action, sectionNames, fieldById);
            automations.add(new TaskListTemplates.AutomationDef(a.getName(), trigger, action));
        }
        TaskListTemplates.Payload payload = new TaskListTemplates.Payload(
                sections.stream().map(TaskListSection::getName).toList(),
                fields.stream().map(f -> new TaskListTemplates.FieldDef(f.getName(), f.getType(), TaskFieldCodec.options(f.getOptions()))).toList(),
                tasks, automations);
        String name = req.getName() != null && !req.getName().isBlank() ? req.getName().strip() : list.getName();
        TaskListTemplate t = templateRepository.save(TaskListTemplate.builder().organizationId(list.getOrganizationId())
                .name(KpiTaskService.truncate(name, 200)).description(KpiTaskService.blankToNull(req.getDescription()))
                .payload(TaskFieldCodec.write(payload)).createdBy(me.getId()).build());
        return TaskListResponses.Template.builder().id(t.getId().toString()).name(t.getName()).description(t.getDescription())
                .builtin(false).sections(payload.sections()).fieldCount(payload.fields().size()).taskCount(payload.tasks().size())
                .canDelete(true).build();
    }

    @Transactional
    public void deleteTemplate(UUID templateId) {
        User me = taskService.currentUser();
        UUID orgId = taskService.organizationOf(me);
        TaskListTemplate t = templateRepository.findById(templateId).filter(x -> x.getOrganizationId().equals(orgId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_TEMPLATE_NOT_FOUND));
        boolean admin = permissionChecker.isGlobalAdminOfOrganization(me.getId(), orgId);
        if (!admin && !t.getCreatedBy().equals(me.getId())) throw new ForbiddenException(ErrorCode.TASK_LIST_NO_PERMISSION_EDIT);
        t.setDeletedAt(Instant.now());
        templateRepository.save(t);
    }

    /** Dựng nhóm, trường, luật tự động, việc mẫu từ mẫu. */
    private void applyTemplate(User me, TaskList list, TaskListTemplates.Payload p, boolean withTasks) {
        Map<String, UUID> sectionIds = new HashMap<>();
        double order = 1;
        for (String name : p.sections()) {
            if (name == null || name.isBlank() || sectionIds.containsKey(name)) continue;
            TaskListSection s = sectionRepository.save(TaskListSection.builder().listId(list.getId())
                    .name(KpiTaskService.truncate(name.strip(), 120)).sortOrder(order++).build());
            sectionIds.put(name, s.getId());
        }
        Map<String, TaskListField> fields = new HashMap<>();
        order = 1;
        for (TaskListTemplates.FieldDef f : p.fields()) {
            if (f.name() == null || f.type() == null) continue;
            String options = f.type() == TaskFieldType.SINGLE_SELECT || f.type() == TaskFieldType.MULTI_SELECT
                    ? TaskFieldCodec.optionsJson(f.options()) : null;
            fields.put(f.name(), fieldRepository.save(TaskListField.builder().listId(list.getId()).name(f.name())
                    .type(f.type()).options(options).sortOrder(order++).build()));
        }
        for (TaskListTemplates.AutomationDef a : p.automations()) {
            Map<String, Object> trigger = fromNames(a.trigger(), sectionIds, fields);
            Map<String, Object> action = fromNames(a.action(), sectionIds, fields);
            if (trigger == null || action == null) continue;
            automationRepository.save(TaskListAutomation.builder().listId(list.getId()).name(KpiTaskService.truncate(a.name(), 200))
                    .trigger(TaskFieldCodec.write(trigger)).action(TaskFieldCodec.write(action)).createdBy(me.getId()).build());
        }
        if (!withTasks) return;
        LocalDate today = KpiTaskService.today();
        for (TaskListTemplates.TaskDef t : p.tasks()) {
            if (t.title() == null || t.title().isBlank()) continue;
            TaskRecurrence rec = t.recurrence() == null ? null : TaskRecurrence.builder()
                    .freq(TaskRecurrence.Freq.valueOf(t.recurrence())).interval(1).build();
            LocalDate due = t.dueInDays() != null ? today.plusDays(t.dueInDays()) : rec != null ? today : null;
            taskService.createInternal(me, CreateKpiTaskRequest.builder().title(t.title()).listId(list.getId())
                    .sectionId(t.section() != null ? sectionIds.get(t.section()) : null)
                    .dueDate(due).checklist(t.checklist())
                    .priority(t.priority() != null ? KpiTaskPriority.valueOf(t.priority()) : null)
                    .recurrence(rec).build());
        }
    }

    private static void toNames(Map<String, Object> m, Map<UUID, String> sections, Map<UUID, TaskListField> fields) {
        Object s = m.remove("sectionId");
        if (s != null) m.put("section", sections.get(UUID.fromString(s.toString())));
        Object f = m.remove("fieldId");
        if (f != null) {
            TaskListField field = fields.get(UUID.fromString(f.toString()));
            if (field != null) {
                m.put("field", field.getName());
                Object o = m.remove("optionId");
                if (o != null) {
                    TaskFieldCodec.options(field.getOptions()).stream().filter(x -> x.id().equals(o.toString())).findFirst()
                            .ifPresent(x -> m.put("option", x.label()));
                }
            }
        }
        m.remove("userId"); // người cụ thể không đi theo mẫu
    }

    private static Map<String, Object> fromNames(Map<String, Object> raw, Map<String, UUID> sections, Map<String, TaskListField> fields) {
        if (raw == null) return null;
        Map<String, Object> m = new HashMap<>(raw);
        Object s = m.remove("section");
        if (s != null) {
            UUID id = sections.get(s.toString());
            if (id == null) return null;
            m.put("sectionId", id.toString());
        }
        Object f = m.remove("field");
        if (f != null) {
            TaskListField field = fields.get(f.toString());
            if (field == null) return null;
            m.put("fieldId", field.getId().toString());
            Object o = m.remove("option");
            if (o != null) {
                TaskFieldCodec.options(field.getOptions()).stream().filter(x -> x.label().equals(o.toString())).findFirst()
                        .ifPresent(x -> m.put("optionId", x.id()));
            }
        }
        return m;
    }

    private static TaskListTemplates.Payload readPayload(String json) {
        try {
            return JSON.readValue(json, TaskListTemplates.Payload.class);
        } catch (Exception e) {
            return new TaskListTemplates.Payload(List.of(), List.of(), List.of(), List.of());
        }
    }

    // ══ Tự động hoá ══════════════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<TaskListResponses.Automation> automations(UUID listId) {
        User me = taskService.currentUser();
        listAccess.require(me.getId(), findList(listId), TaskListRole.VIEWER);
        return automationRepository.findByListIdOrderByCreatedAtAsc(listId).stream().map(mapper::toAutomation).toList();
    }

    @Transactional
    public TaskListResponses.Automation createAutomation(UUID listId, TaskListRequests.Automation req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        if (automationRepository.findByListIdOrderByCreatedAtAsc(listId).size() >= MAX_AUTOMATIONS) {
            throw new BusinessException(ErrorCode.TASK_AUTOMATION_INVALID);
        }
        TaskAutomationRule.validate(list, req.getTrigger(), req.getAction(), sectionRepository, fieldRepository,
                uid -> userRoleOrgUnitRepository.findByUserId(uid).stream()
                        .anyMatch(a -> list.getOrganizationId().equals(PermissionChecker.organizationIdOf(a.getOrgUnit()))));
        if (req.getName() == null || req.getName().isBlank()) throw new BusinessException(ErrorCode.TASK_AUTOMATION_INVALID);
        TaskListAutomation a = automationRepository.save(TaskListAutomation.builder().listId(listId)
                .name(KpiTaskService.truncate(req.getName().strip(), 200))
                .trigger(TaskFieldCodec.write(req.getTrigger())).action(TaskFieldCodec.write(req.getAction()))
                .enabled(req.getEnabled() == null || req.getEnabled()).createdBy(me.getId()).build());
        return mapper.toAutomation(a);
    }

    @Transactional
    public TaskListResponses.Automation updateAutomation(UUID listId, UUID automationId, TaskListRequests.Automation req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.OWNER);
        TaskListAutomation a = automationRepository.findById(automationId).filter(x -> x.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_AUTOMATION_NOT_FOUND));
        Map<String, Object> trigger = req.getTrigger() != null ? req.getTrigger() : mapper.map(a.getTrigger());
        Map<String, Object> action = req.getAction() != null ? req.getAction() : mapper.map(a.getAction());
        TaskAutomationRule.validate(list, trigger, action, sectionRepository, fieldRepository,
                uid -> userRoleOrgUnitRepository.findByUserId(uid).stream()
                        .anyMatch(x -> list.getOrganizationId().equals(PermissionChecker.organizationIdOf(x.getOrgUnit()))));
        if (req.getName() != null && !req.getName().isBlank()) a.setName(KpiTaskService.truncate(req.getName().strip(), 200));
        a.setTrigger(TaskFieldCodec.write(trigger));
        a.setAction(TaskFieldCodec.write(action));
        if (req.getEnabled() != null) a.setEnabled(req.getEnabled());
        return mapper.toAutomation(automationRepository.save(a));
    }

    @Transactional
    public void deleteAutomation(UUID listId, UUID automationId) {
        User me = taskService.currentUser();
        editableList(me, listId, TaskListRole.OWNER);
        TaskListAutomation a = automationRepository.findById(automationId).filter(x -> x.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_AUTOMATION_NOT_FOUND));
        automationRepository.delete(a);
    }

    // ══ Thống kê ═════════════════════════════════════════════════════════════════════════════════

    /** Thống kê trên các việc gốc của danh sách mà NGƯỜI XEM thấy được (không lộ số của việc riêng tư / KPI người khác). */
    @Transactional(readOnly = true)
    public TaskListResponses.Stats stats(UUID listId) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.VIEWER);
        UUID orgId = list.getOrganizationId();
        KpiAccessPolicy.Viewer viewer = kpiAccessPolicy.viewer(me.getId(), orgId);
        LocalDate today = KpiTaskService.today();
        TaskSearch.Result found = search.search(new TaskSearch.Criteria("LIST", me.getId(), orgId, listId, null, false,
                null, null, null, null, null, null, false, null, null, false, null, null, null, null, null,
                "manual", null, null, true, listAccess.rolesOf(me.getId()).keySet(),
                permissionChecker.hasPermission(me.getId(), KpiTaskAccess.VIEW_TEAM), viewer.managerUnitPaths(), viewer.admin(), false,
                today, LocalTime.now(KpiTaskService.ZONE), 0, 5000));
        List<KpiTask> tasks = taskRepository.findAllById(found.ids());
        Map<UUID, TaskListItem> items = itemRepository.findByListId(listId).stream()
                .collect(Collectors.toMap(TaskListItem::getTaskId, Function.identity()));
        Map<UUID, List<UUID>> assignees = new HashMap<>();
        for (KpiTaskAssignee a : assigneeRepository.findByTaskIdIn(found.ids())) {
            assignees.computeIfAbsent(a.getTaskId(), k -> new ArrayList<>()).add(a.getUserId());
        }
        Map<KpiTaskStatus, Long> byStatus = new EnumMap<>(KpiTaskStatus.class);
        for (KpiTaskStatus s : KpiTaskStatus.values()) byStatus.put(s, 0L);
        long overdue = 0, noDue = 0;
        Map<UUID, long[]> byUser = new HashMap<>();
        Map<UUID, long[]> bySection = new HashMap<>();
        Map<LocalDate, long[]> weekly = new TreeMap<>();
        LocalDate fromWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(7);
        for (int i = 0; i < 8; i++) weekly.put(fromWeek.plusWeeks(i), new long[]{0, 0});
        for (KpiTask t : tasks) {
            byStatus.merge(t.getStatus(), 1L, Long::sum);
            boolean open = t.getStatus() == KpiTaskStatus.TODO || t.getStatus() == KpiTaskStatus.IN_PROGRESS;
            boolean done = t.getStatus() == KpiTaskStatus.DONE;
            boolean late = open && t.getDueDate() != null && t.getDueDate().isBefore(today);
            if (late) overdue++;
            if (t.getDueDate() == null && open) noDue++;
            for (UUID u : assignees.getOrDefault(t.getId(), List.of())) {
                long[] c = byUser.computeIfAbsent(u, k -> new long[3]);
                if (open) c[0]++;
                if (done) c[1]++;
                if (late) c[2]++;
            }
            TaskListItem item = items.get(t.getId());
            UUID sec = item != null ? item.getSectionId() : null;
            long[] sc = bySection.computeIfAbsent(sec == null ? new UUID(0, 0) : sec, k -> new long[2]);
            if (open) sc[0]++;
            if (done) sc[1]++;
            LocalDate cw = LocalDate.ofInstant(t.getCreatedAt(), KpiTaskService.ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            if (weekly.containsKey(cw)) weekly.get(cw)[0]++;
            if (t.getCompletedAt() != null && done) {
                LocalDate dw = LocalDate.ofInstant(t.getCompletedAt(), KpiTaskService.ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                if (weekly.containsKey(dw)) weekly.get(dw)[1]++;
            }
        }
        Map<UUID, User> users = userRepository.findAllById(byUser.keySet()).stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, String> sectionNames = sectionRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(listId).stream()
                .collect(Collectors.toMap(TaskListSection::getId, TaskListSection::getName, (a, b) -> a, LinkedHashMap::new));
        long open = byStatus.get(KpiTaskStatus.TODO) + byStatus.get(KpiTaskStatus.IN_PROGRESS);
        return TaskListResponses.Stats.builder()
                .total(tasks.size()).open(open).done(byStatus.get(KpiTaskStatus.DONE)).cancelled(byStatus.get(KpiTaskStatus.CANCELLED))
                .overdue(overdue).noDue(noDue).byStatus(byStatus)
                .byAssignee(byUser.entrySet().stream().map(e -> {
                    User u = users.get(e.getKey());
                    return TaskListResponses.AssigneeStat.builder().userId(e.getKey()).name(u != null ? u.getFullName() : null)
                            .avatarUrl(u != null ? u.getAvatarUrl() : null).open(e.getValue()[0]).done(e.getValue()[1]).overdue(e.getValue()[2]).build();
                }).sorted(Comparator.comparingLong(TaskListResponses.AssigneeStat::getOpen).reversed()).toList())
                .bySection(bySection.entrySet().stream().map(e -> TaskListResponses.SectionStat.builder()
                        .sectionId(e.getKey().equals(new UUID(0, 0)) ? null : e.getKey())
                        .name(sectionNames.get(e.getKey())).open(e.getValue()[0]).done(e.getValue()[1]).build())
                        .sorted(Comparator.comparingInt(s -> s.getSectionId() == null ? -1 : new ArrayList<>(sectionNames.keySet()).indexOf(s.getSectionId())))
                        .toList())
                .weekly(weekly.entrySet().stream().map(e -> TaskListResponses.WeekStat.builder().weekStart(e.getKey())
                        .created(e.getValue()[0]).completed(e.getValue()[1]).build()).toList())
                .build();
    }

    // ══ Tiện ích ═════════════════════════════════════════════════════════════════════════════════

    TaskListResponses.TaskListDetail detail(TaskList list, TaskListRole role, User me) {
        TaskListResponses.TaskListDetail d = mapper.toDetail(list);
        d.setRole(role);
        List<TaskListMember> members = memberRepository.findByListIdOrderByAddedAtAsc(list.getId());
        Map<UUID, User> users = userRepository.findAllById(members.stream().map(TaskListMember::getUserId).filter(Objects::nonNull).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, OrgUnit> units = orgUnitRepository.findAllById(members.stream().map(TaskListMember::getOrgUnitId).filter(Objects::nonNull).toList())
                .stream().collect(Collectors.toMap(OrgUnit::getId, Function.identity()));
        d.setMembers(members.stream().map(m -> {
            User u = m.getUserId() != null ? users.get(m.getUserId()) : null;
            OrgUnit o = m.getOrgUnitId() != null ? units.get(m.getOrgUnitId()) : null;
            return TaskListResponses.Member.builder().id(m.getId()).userId(m.getUserId()).userName(u != null ? u.getFullName() : null)
                    .avatarUrl(u != null ? u.getAvatarUrl() : null).orgUnitId(m.getOrgUnitId()).orgUnitName(o != null ? o.getName() : null)
                    .role(m.getRole()).build();
        }).toList());
        d.setSections(sectionRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(list.getId()).stream().map(mapper::toSection).toList());
        d.setFields(fieldRepository.findByListIdOrderBySortOrderAscCreatedAtAsc(list.getId()).stream().map(mapper::toField).toList());
        long open = 0;
        for (Object[] r : listRepository.openCounts(List.of(list.getId()), me.getId())) open = ((Number) r[1]).longValue();
        d.setOpenCount(open);
        d.setTotalCount(itemRepository.findByListId(list.getId()).size());
        return d;
    }

    TaskList findList(UUID id) {
        return listRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_NOT_FOUND));
    }

    /** Danh sách để GHI: đủ vai trò và chưa lưu trữ. */
    // ══ Tuỳ chọn riêng + bảng điều khiển (V42 §5) ═══════════════════════════════════════════════════════

    /** Ghim / thư mục của RIÊNG tôi với một danh sách mình là thành viên (cả danh sách đã lưu trữ). */
    @Transactional
    public void setMyPrefs(UUID listId, TaskListRequests.MyPrefs req) {
        User me = taskService.currentUser();
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, TaskListRole.VIEWER);
        TaskListUserPref p = prefRepository.findById(new TaskListUserPref.Key(listId, me.getId()))
                .orElse(TaskListUserPref.builder().listId(listId).userId(me.getId()).build());
        if (req.getPinned() != null) p.setPinned(req.getPinned());
        if (req.isClearFolder()) p.setFolder(null);
        else if (req.getFolder() != null) p.setFolder(KpiTaskService.blankToNull(req.getFolder().strip()));
        p.setUpdatedAt(Instant.now());
        if (!p.isPinned() && p.getFolder() == null) prefRepository.deleteById(new TaskListUserPref.Key(listId, me.getId()));
        else prefRepository.save(p);
    }

    /** Lưu cấu hình bảng điều khiển của danh sách (biên tập trở lên; null = về mặc định). */
    @Transactional
    public TaskListResponses.TaskListDetail setDashboard(UUID listId, TaskListRequests.Dashboard req) {
        User me = taskService.currentUser();
        TaskList list = editableList(me, listId, TaskListRole.EDITOR);
        String json = req.getConfig() == null ? null : TaskFieldCodec.write(req.getConfig());
        if (json != null && json.length() > MAX_DASHBOARD_JSON) throw new BusinessException(ErrorCode.TASK_LIST_DASHBOARD_INVALID);
        list.setDashboard(json);
        list = listRepository.saveAndFlush(list);
        return detail(list, listAccess.roleOf(me.getId(), listId), me);
    }

    TaskList editableList(User me, UUID listId, TaskListRole min) {
        TaskList list = findList(listId);
        listAccess.require(me.getId(), list, min);
        if (list.getArchivedAt() != null) throw new BusinessException(ErrorCode.TASK_LIST_ARCHIVED);
        return list;
    }

    private TaskListSection section(UUID listId, UUID sectionId) {
        return sectionRepository.findById(sectionId).filter(s -> s.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_LIST_SECTION_NOT_FOUND));
    }

    private TaskListField field(UUID listId, UUID fieldId) {
        return fieldRepository.findById(fieldId).filter(f -> f.getListId().equals(listId))
                .orElseThrow(() -> new BusinessException(ErrorCode.TASK_FIELD_NOT_FOUND));
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) throw new BusinessException(ErrorCode.TASK_LIST_NAME_REQUIRED);
        return KpiTaskService.truncate(name.strip(), 200);
    }

    private static String requireSectionName(String name) {
        if (name == null || name.isBlank()) throw new BusinessException(ErrorCode.TASK_LIST_NAME_REQUIRED);
        return KpiTaskService.truncate(name.strip(), 120);
    }
}
