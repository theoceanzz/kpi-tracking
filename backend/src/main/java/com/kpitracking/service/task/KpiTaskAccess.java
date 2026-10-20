package com.kpitracking.service.task;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.KpiTaskAssignee;
import com.kpitracking.entity.KpiTaskFollower;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiTaskAttachmentKind;
import com.kpitracking.enums.KpiTaskVisibility;
import com.kpitracking.enums.TaskListRole;
import com.kpitracking.repository.KpiTaskAssigneeRepository;
import com.kpitracking.repository.KpiTaskFollowerRepository;
import com.kpitracking.repository.KpiTaskRepository;
import com.kpitracking.repository.TaskListRepository;
import com.kpitracking.repository.UserRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Ai xem / sửa / giao / xoá được một công việc — MỘT luật (docs/TASKS_DESIGN.md §5). Cùng luật viết bằng SQL ở
 * {@link TaskSearch} (vị từ "xem được"); sửa luật phải sửa cả hai (test {@code TaskVisibilityParityIT}).
 *
 * <table>
 *   <tr><td>Người tạo · người thực hiện</td><td>xem, sửa, đổi trạng thái, việc con, checklist… (người tạo: + giao lại, xoá)</td></tr>
 *   <tr><td>Người theo dõi</td><td>xem, bình luận, nhận thông báo — không sửa</td></tr>
 *   <tr><td>Người tạo / thực hiện / theo dõi của việc TỔ TIÊN</td><td>như với chính việc đó (theo dõi: chỉ xem)</td></tr>
 *   <tr><td>Thành viên danh sách chứa việc gốc</td><td>CHỈ việc không KPI và không riêng tư: VIEWER xem, EDITOR sửa + giao, OWNER + xoá</td></tr>
 *   <tr><td>Cấp trên có TASK:VIEW_TEAM</td><td>xem (chỉ đọc) việc {@code KPI_SCOPE}: có KPI ⇒ xem được KPI; không KPI ⇒ một người
 *   thực hiện thuộc đơn vị mình quản lý (hoặc mình là quản trị tổ chức)</td></tr>
 * </table>
 * {@code PRIVATE}: chỉ người tạo / thực hiện / theo dõi (của việc hoặc tổ tiên) — kể cả quản trị viên cũng không.
 *
 * <p>Danh sách nhiều việc dùng {@link #scope} để nạp dữ kiện một lần cho cả trang.
 */
@Component
@RequiredArgsConstructor
public class KpiTaskAccess {

    public static final String VIEW_OWN = "TASK:VIEW_OWN";
    public static final String VIEW_TEAM = "TASK:VIEW_TEAM";
    public static final String ASSIGN = "TASK:ASSIGN";

    private final PermissionChecker permissionChecker;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskAssigneeRepository assigneeRepository;
    private final KpiTaskRepository taskRepository;
    private final TaskListRepository listRepository;
    private final TaskListAccess listAccess;
    private final TaskKpiLinks kpiLinks;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;
    private final UserRepository userRepository;

    // ══ Một việc ═════════════════════════════════════════════════════════════════════════════════

    public boolean isOwner(UUID userId, KpiTask task) {
        return task.getOwner() != null && task.getOwner().getId().equals(userId);
    }

    public boolean isCreator(UUID userId, KpiTask task) {
        return userId != null && userId.equals(task.getCreatedBy());
    }

    public boolean isAssignee(UUID userId, KpiTask task) {
        return userId != null && task.getId() != null && assigneeRepository.existsByTaskIdAndUserId(task.getId(), userId);
    }

    public boolean isFollower(UUID userId, KpiTask task) {
        return userId != null && task.getId() != null && followerRepository.existsByTaskIdAndUserId(task.getId(), userId);
    }

    public boolean canView(UUID userId, KpiTask task) {
        return task != null && userId != null && scope(userId, List.of(task)).canView(task);
    }

    public boolean canEdit(UUID userId, KpiTask task) {
        return task != null && userId != null && scope(userId, List.of(task)).canEdit(task);
    }

    public boolean canReassign(UUID userId, KpiTask task) {
        return task != null && userId != null && scope(userId, List.of(task)).canReassign(task);
    }

    public boolean canDelete(UUID userId, KpiTask task) {
        return task != null && userId != null && scope(userId, List.of(task)).canDelete(task);
    }

    public boolean canRemoveFile(UUID userId, KpiTask task, UUID uploadedBy, KpiTaskAttachmentKind kind) {
        return task != null && userId != null && scope(userId, List.of(task)).canRemoveFile(task, uploadedBy, kind);
    }

    /** Người này có xem được (chỉ đọc) việc công khai của người khác trên KPI này không (tab Công việc của KPI). */
    public boolean canViewTeamTasksOf(UUID userId, KpiCriteria kpi) {
        if (kpi == null) return false;
        return permissionChecker.hasPermission(userId, VIEW_TEAM) && kpiAccessPolicy.canView(userId, kpi);
    }

    /** {@code userId} có phải người tạo / người thực hiện của KPI không — mọi người thực hiện việc gắn KPI phải thoả. */
    public static boolean isKpiOf(UUID userId, KpiCriteria kpi) {
        return (kpi.getCreatedBy() != null && kpi.getCreatedBy().getId().equals(userId))
                || kpi.getAssignees().stream().anyMatch(a -> a.getId().equals(userId));
    }

    /** Có được giao việc trên {@code kpi} cho {@code assigneeId} không (chưa xét trạng thái KPI / khoá kỳ). */
    public boolean canAssign(UUID assignerId, UUID assigneeId, KpiCriteria kpi) {
        if (assignerId.equals(assigneeId)) return true;
        if (!permissionChecker.hasPermission(assignerId, ASSIGN)) return false;
        if (!kpiAccessPolicy.canView(assignerId, kpi)) return false;
        return isInManagedScope(assignerId, assigneeId, KpiAccessPolicy.organizationIdOf(kpi));
    }

    /**
     * Việc KHÔNG KPI: giao được cho bất kỳ ai đang hoạt động trong cùng tổ chức có trang Công việc ({@code TASK:VIEW_OWN})
     * — giao chéo phòng ban; người nhận có quyền từ chối.
     */
    public boolean canAssignWithoutKpi(UUID assignerId, UUID assigneeId, UUID organizationId) {
        if (assignerId.equals(assigneeId)) return true;
        if (organizationId == null) return false;
        boolean active = userRepository.findById(assigneeId)
                .map(u -> u.getDeletedAt() == null && "ACTIVE".equals(String.valueOf(u.getStatus()))).orElse(false);
        if (!active || !permissionChecker.hasPermission(assigneeId, VIEW_OWN)) return false;
        return userRoleOrgUnitRepository.findByUserId(assigneeId).stream()
                .anyMatch(a -> organizationId.equals(PermissionChecker.organizationIdOf(a.getOrgUnit())));
    }

    /** Người nhận thuộc một đơn vị mà người giao là trưởng/phó (hoặc đơn vị con của nó); quản trị viên: cả tổ chức. */
    public boolean isInManagedScope(UUID assignerId, UUID assigneeId, UUID organizationId) {
        if (organizationId != null && permissionChecker.isGlobalAdminOfOrganization(assignerId, organizationId)) {
            return userRoleOrgUnitRepository.findByUserId(assigneeId).stream()
                    .anyMatch(a -> organizationId.equals(PermissionChecker.organizationIdOf(a.getOrgUnit())));
        }
        List<String> managed = userRoleOrgUnitRepository.findByUserId(assignerId).stream()
                .filter(a -> a.getRole().getRank() != null && a.getRole().getRank() <= 1)
                .map(a -> a.getOrgUnit().getPath()).toList();
        if (managed.isEmpty()) return false;
        for (UserRoleOrgUnit a : userRoleOrgUnitRepository.findByUserId(assigneeId)) {
            String path = a.getOrgUnit().getPath();
            if (path != null && managed.stream().anyMatch(path::startsWith)) return true;
        }
        return false;
    }

    // ══ Nhiều việc ═══════════════════════════════════════════════════════════════════════════════

    /** Dữ kiện quyền của MỘT người trên một nhóm việc, nạp một lần (danh sách, chi tiết, thao tác hàng loạt). */
    public Scope scope(UUID userId, Collection<KpiTask> tasks) {
        Set<UUID> ancestorIds = new HashSet<>();
        for (KpiTask t : tasks) {
            if (t.getAncestorIds() != null) ancestorIds.addAll(Arrays.asList(t.getAncestorIds()));
            if (t.getParentTaskId() != null) ancestorIds.add(t.getParentTaskId());
        }
        Map<UUID, KpiTask> ancestors = ancestorIds.isEmpty() ? Map.of() : taskRepository.findAllById(ancestorIds).stream()
                .collect(Collectors.toMap(KpiTask::getId, Function.identity()));
        Set<UUID> all = new HashSet<>(ancestorIds);
        tasks.forEach(t -> all.add(t.getId()));
        Map<UUID, Set<UUID>> assignees = new HashMap<>();
        Map<UUID, Set<UUID>> followers = new HashMap<>();
        if (!all.isEmpty()) {
            for (KpiTaskAssignee a : assigneeRepository.findByTaskIdIn(all)) {
                assignees.computeIfAbsent(a.getTaskId(), k -> new HashSet<>()).add(a.getUserId());
            }
            for (KpiTaskFollower f : followerRepository.findByTaskIdIn(all)) {
                followers.computeIfAbsent(f.getTaskId(), k -> new HashSet<>()).add(f.getUserId());
            }
        }
        Set<UUID> roots = tasks.stream().map(KpiTask::rootId).collect(Collectors.toSet());
        Map<UUID, List<UUID>> listsByRoot = new HashMap<>();
        if (!roots.isEmpty()) {
            for (Object[] r : listRepository.listsOfTasks(roots)) {
                listsByRoot.computeIfAbsent(uuid(r[0]), k -> new ArrayList<>()).add(uuid(r[1]));
            }
        }
        Set<UUID> listIds = listsByRoot.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        Map<UUID, TaskListRole> listRoles = userId == null ? Map.of() : listAccess.rolesOf(userId, listIds);
        return new Scope(userId, ancestors, assignees, followers, listsByRoot, listRoles, kpiLinks.ofAll(tasks));
    }

    /** Quyền của một người trên các việc đã nạp — mọi câu trả lời không truy vấn thêm, trừ nhánh "cấp trên" (lười). */
    public final class Scope {

        private final UUID me;
        private final Map<UUID, KpiTask> ancestors;
        private final Map<UUID, Set<UUID>> assignees;
        private final Map<UUID, Set<UUID>> followers;
        private final Map<UUID, List<UUID>> listsByRoot;
        private final Map<UUID, TaskListRole> listRoles;
        private final Map<UUID, TaskKpiLinks.Link> links;
        private Boolean viewTeam;
        private final Map<UUID, KpiAccessPolicy.Viewer> viewers = new HashMap<>();

        private Scope(UUID me, Map<UUID, KpiTask> ancestors, Map<UUID, Set<UUID>> assignees, Map<UUID, Set<UUID>> followers,
                      Map<UUID, List<UUID>> listsByRoot, Map<UUID, TaskListRole> listRoles, Map<UUID, TaskKpiLinks.Link> links) {
            this.me = me;
            this.ancestors = ancestors;
            this.assignees = assignees;
            this.followers = followers;
            this.listsByRoot = listsByRoot;
            this.listRoles = listRoles;
            this.links = links;
        }

        public TaskKpiLinks.Link link(KpiTask t) {
            return links.getOrDefault(t.getId(), kpiLinks.of(t));
        }

        public Set<UUID> assigneesOf(KpiTask t) {
            return assignees.getOrDefault(t.getId(), Set.of());
        }

        public boolean isAssignee(KpiTask t) {
            return assigneesOf(t).contains(me);
        }

        private boolean editorOf(KpiTask t) {
            return me.equals(t.getCreatedBy()) || assignees.getOrDefault(t.getId(), Set.of()).contains(me);
        }

        private boolean involvedIn(KpiTask t) {
            return editorOf(t) || followers.getOrDefault(t.getId(), Set.of()).contains(me);
        }

        private List<KpiTask> ancestorsOf(KpiTask t) {
            List<KpiTask> out = new ArrayList<>();
            if (t.getAncestorIds() != null) {
                for (UUID id : t.getAncestorIds()) if (ancestors.containsKey(id)) out.add(ancestors.get(id));
            }
            if (t.getParentTaskId() != null && ancestors.containsKey(t.getParentTaskId())
                    && out.stream().noneMatch(a -> a.getId().equals(t.getParentTaskId()))) {
                out.add(ancestors.get(t.getParentTaskId()));
            }
            return out;
        }

        /** Người tạo / thực hiện (/ theo dõi nếu {@code view}) của chính việc hoặc tổ tiên. */
        private boolean treeInvolved(KpiTask t, boolean view) {
            if (view ? involvedIn(t) : editorOf(t)) return true;
            for (KpiTask a : ancestorsOf(t)) if (view ? involvedIn(a) : editorOf(a)) return true;
            return false;
        }

        private boolean ancestorEditor(KpiTask t) {
            for (KpiTask a : ancestorsOf(t)) if (editorOf(a)) return true;
            return false;
        }

        /** Vai trò danh sách có hiệu lực trên việc: chỉ việc không KPI và không riêng tư. */
        public TaskListRole listRole(KpiTask t) {
            if (!link(t).none() || t.getVisibility() == KpiTaskVisibility.PRIVATE) return null;
            TaskListRole best = null;
            for (UUID listId : listsByRoot.getOrDefault(t.rootId(), List.of())) best = TaskListRole.max(best, listRoles.get(listId));
            return best;
        }

        private boolean team(KpiTask t) {
            if (t.getVisibility() != KpiTaskVisibility.KPI_SCOPE) return false;
            if (viewTeam == null) viewTeam = permissionChecker.hasPermission(me, VIEW_TEAM);
            if (!viewTeam) return false;
            TaskKpiLinks.Link link = link(t);
            KpiAccessPolicy.Viewer v = viewers.computeIfAbsent(t.getOrganizationId(), org -> kpiAccessPolicy.viewer(me, org));
            if (link.active()) return kpiAccessPolicy.canView(v, link.kpi());
            if (!link.none()) return false;
            if (v.admin()) return true;
            if (v.managerUnitPaths().isEmpty()) return false;
            Set<UUID> ids = assigneesOf(t);
            if (ids.isEmpty()) return false;
            return userRoleOrgUnitRepository.findByUserIdInWithUnit(ids).stream()
                    .map(a -> a.getOrgUnit() == null ? null : a.getOrgUnit().getPath())
                    .filter(Objects::nonNull)
                    .anyMatch(p -> v.managerUnitPaths().stream().anyMatch(p::startsWith));
        }

        public boolean canView(KpiTask t) {
            return treeInvolved(t, true) || listRole(t) != null || team(t);
        }

        public boolean canEdit(KpiTask t) {
            if (treeInvolved(t, false)) return true;
            TaskListRole r = listRole(t);
            return r != null && r.atLeast(TaskListRole.EDITOR);
        }

        /** Giao lại / đổi người thực hiện / đổi KPI. Người thực hiện tự mình không giao lại được (chỉ từ chối). */
        public boolean canReassign(KpiTask t) {
            if (me.equals(t.getCreatedBy()) || ancestorEditor(t)) return true;
            TaskListRole r = listRole(t);
            return r != null && r.atLeast(TaskListRole.EDITOR);
        }

        public boolean canDelete(KpiTask t) {
            if (me.equals(t.getCreatedBy())) return true;
            TaskListRole r = listRole(t);
            return r == TaskListRole.OWNER;
        }

        /**
         * Xoá một tệp của việc (V47) — ngoài {@link #canEdit}. Người tải lên luôn xoá được tệp của mình. Tệp đính kèm:
         * thêm người giao (người tạo / người sửa ở việc tổ tiên / biên tập danh sách) — người thực hiện KHÔNG xoá được
         * tài liệu người giao đưa. Kết quả: chỉ người nộp; người giao chỉ dọn được khi người nộp không còn thực hiện việc.
         */
        public boolean canRemoveFile(KpiTask t, UUID uploadedBy, KpiTaskAttachmentKind kind) {
            if (me.equals(uploadedBy)) return true;
            if (!canReassign(t)) return false;
            return kind != KpiTaskAttachmentKind.RESULT || !assigneesOf(t).contains(uploadedBy);
        }

        /** Từ chối: việc không KPI, mình đang thực hiện và không phải người tạo. */
        public boolean canDecline(KpiTask t) {
            return link(t).none() && isAssignee(t) && !me.equals(t.getCreatedBy());
        }
    }

    private static UUID uuid(Object o) {
        return o instanceof UUID u ? u : UUID.fromString(o.toString());
    }
}
