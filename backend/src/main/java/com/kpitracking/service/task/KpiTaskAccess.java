package com.kpitracking.service.task;

import com.kpitracking.entity.KpiCriteria;
import com.kpitracking.entity.KpiTask;
import com.kpitracking.entity.UserRoleOrgUnit;
import com.kpitracking.enums.KpiTaskVisibility;
import com.kpitracking.repository.KpiCriteriaRepository;
import com.kpitracking.repository.KpiTaskFollowerRepository;
import com.kpitracking.repository.KpiTaskRepository;
import com.kpitracking.repository.UserRoleOrgUnitRepository;
import com.kpitracking.security.PermissionChecker;
import com.kpitracking.service.kpi.KpiAccessPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Ai xem / sửa / giao / xoá được một công việc.
 *
 * <table>
 *   <tr><td>Người phụ trách (owner)</td><td>xem, sửa, đổi trạng thái, hoàn thành, quản lý việc con & checklist</td></tr>
 *   <tr><td>Người tạo</td><td>như người phụ trách + giao lại + xoá</td></tr>
 *   <tr><td>Người theo dõi</td><td>xem, bình luận, nhận thông báo — không sửa</td></tr>
 *   <tr><td>Cấp trên có TASK:VIEW_TEAM</td><td>xem (chỉ đọc) việc {@code KPI_SCOPE} trên KPI mình xem được</td></tr>
 * </table>
 * Ba vai trò đầu xem được cả việc {@code PRIVATE}; ngoài họ thì không ai, kể cả quản trị viên. Việc con: ai xem / sửa
 * được việc cha thì cũng xem / sửa được việc con của nó.
 *
 * <p>Giao việc ({@link #canAssign}): tự giao cho mình luôn được; giao cho người khác cần {@code TASK:ASSIGN}, người
 * nhận thuộc đơn vị mình quản lý (rank ≤ 1) hoặc đơn vị con, và người giao xem được KPI đích ({@link KpiAccessPolicy}).
 */
@Component
@RequiredArgsConstructor
public class KpiTaskAccess {

    public static final String VIEW_OWN = "TASK:VIEW_OWN";
    public static final String VIEW_TEAM = "TASK:VIEW_TEAM";
    public static final String ASSIGN = "TASK:ASSIGN";

    private final PermissionChecker permissionChecker;
    private final KpiAccessPolicy kpiAccessPolicy;
    private final KpiCriteriaRepository kpiCriteriaRepository;
    private final KpiTaskFollowerRepository followerRepository;
    private final KpiTaskRepository taskRepository;
    private final UserRoleOrgUnitRepository userRoleOrgUnitRepository;

    public boolean isOwner(UUID userId, KpiTask task) {
        return task.getOwner() != null && task.getOwner().getId().equals(userId);
    }

    public boolean isCreator(UUID userId, KpiTask task) {
        return userId != null && userId.equals(task.getCreatedBy());
    }

    public boolean isFollower(UUID userId, KpiTask task) {
        return userId != null && task.getId() != null && followerRepository.existsByTaskIdAndUserId(task.getId(), userId);
    }

    public boolean canView(UUID userId, KpiTask task) {
        if (task == null || userId == null) return false;
        if (isOwner(userId, task) || isCreator(userId, task) || isFollower(userId, task)) return true;
        if (task.getParentTaskId() != null) {
            KpiTask parent = taskRepository.findById(task.getParentTaskId()).orElse(null);
            if (parent != null && (isOwner(userId, parent) || isCreator(userId, parent) || isFollower(userId, parent))) return true;
        }
        if (task.getVisibility() != KpiTaskVisibility.KPI_SCOPE) return false;
        KpiCriteria kpi = kpiCriteriaRepository.findById(task.getKpiCriteriaId()).orElse(null);
        return canViewTeamTasksOf(userId, kpi);
    }

    /** Sửa nội dung / trạng thái / việc con / checklist / người theo dõi / nhắc (chưa xét khoá kỳ). */
    public boolean canEdit(UUID userId, KpiTask task) {
        if (isOwner(userId, task) || isCreator(userId, task)) return true;
        if (task.getParentTaskId() == null) return false;
        KpiTask parent = taskRepository.findById(task.getParentTaskId()).orElse(null);
        return parent != null && (isOwner(userId, parent) || isCreator(userId, parent));
    }

    /** Giao lại: người tạo (của việc, hoặc của việc cha với việc con). */
    public boolean canReassign(UUID userId, KpiTask task) {
        if (isCreator(userId, task)) return true;
        if (task.getParentTaskId() == null) return false;
        KpiTask parent = taskRepository.findById(task.getParentTaskId()).orElse(null);
        return parent != null && (isOwner(userId, parent) || isCreator(userId, parent));
    }

    /** Xoá: chỉ người tạo. Người phụ trách được giao thì chuyển sang Huỷ. */
    public boolean canDelete(UUID userId, KpiTask task) {
        return isCreator(userId, task);
    }

    /** Người này có xem được (chỉ đọc) task công khai của người khác trên KPI này không. */
    public boolean canViewTeamTasksOf(UUID userId, KpiCriteria kpi) {
        if (kpi == null) return false;
        return permissionChecker.hasPermission(userId, VIEW_TEAM) && kpiAccessPolicy.canView(userId, kpi);
    }

    /** {@code assignee} có phải người tạo / người thực hiện của KPI không — task luôn gắn KPI của người phụ trách. */
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
}
