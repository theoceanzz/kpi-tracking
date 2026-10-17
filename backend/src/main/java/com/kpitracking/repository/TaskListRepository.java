package com.kpitracking.repository;

import com.kpitracking.entity.TaskList;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListRepository extends JpaRepository<TaskList, UUID> {

    /**
     * Vai trò của một người trên các danh sách (trực tiếp, hoặc qua đơn vị — đơn vị gồm cả đơn vị con): [list_id, role].
     * Một danh sách có thể ra nhiều dòng; lấy vai trò cao nhất ở {@code TaskListAccess}.
     */
    @Query(value = "SELECT m.list_id, m.role FROM task_list_members m " +
            "JOIN task_lists l ON l.id = m.list_id AND l.deleted_at IS NULL " +
            "WHERE m.user_id = :uid " +
            "UNION ALL " +
            "SELECT m.list_id, m.role FROM task_list_members m " +
            "JOIN task_lists l ON l.id = m.list_id AND l.deleted_at IS NULL " +
            "JOIN org_units mu ON mu.id = m.org_unit_id " +
            "WHERE EXISTS (SELECT 1 FROM user_role_org_units uro JOIN org_units ou ON ou.id = uro.org_unit_id " +
            "              WHERE uro.user_id = :uid AND ou.deleted_at IS NULL AND ou.path LIKE mu.path || '%')",
            nativeQuery = true)
    List<Object[]> rolesOf(@Param("uid") UUID userId);

    /** Như {@link #rolesOf} nhưng chỉ cho các danh sách đang xét. */
    @Query(value = "SELECT m.list_id, m.role FROM task_list_members m " +
            "WHERE m.list_id IN (:listIds) AND m.user_id = :uid " +
            "UNION ALL " +
            "SELECT m.list_id, m.role FROM task_list_members m JOIN org_units mu ON mu.id = m.org_unit_id " +
            "WHERE m.list_id IN (:listIds) " +
            "  AND EXISTS (SELECT 1 FROM user_role_org_units uro JOIN org_units ou ON ou.id = uro.org_unit_id " +
            "              WHERE uro.user_id = :uid AND ou.deleted_at IS NULL AND ou.path LIKE mu.path || '%')",
            nativeQuery = true)
    List<Object[]> rolesOfIn(@Param("uid") UUID userId, @Param("listIds") Collection<UUID> listIds);

    /** Danh sách chứa các việc gốc: [task_id, list_id]. */
    @Query(value = "SELECT li.task_id, li.list_id FROM task_list_items li " +
            "JOIN task_lists l ON l.id = li.list_id AND l.deleted_at IS NULL WHERE li.task_id IN (:taskIds)",
            nativeQuery = true)
    List<Object[]> listsOfTasks(@Param("taskIds") Collection<UUID> taskIds);

    /** Người dùng (đang hoạt động) có quyền trên danh sách: thành viên trực tiếp + người thuộc đơn vị thành viên. */
    @Query(value = "SELECT DISTINCT u.id FROM users u WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE' AND (" +
            "  EXISTS (SELECT 1 FROM task_list_members m WHERE m.list_id = :listId AND m.user_id = u.id) OR " +
            "  EXISTS (SELECT 1 FROM task_list_members m JOIN org_units mu ON mu.id = m.org_unit_id " +
            "          JOIN user_role_org_units uro ON uro.user_id = u.id JOIN org_units ou ON ou.id = uro.org_unit_id " +
            "          WHERE m.list_id = :listId AND ou.deleted_at IS NULL AND ou.path LIKE mu.path || '%')) " +
            "LIMIT :lim", nativeQuery = true)
    List<UUID> memberUserIds(@Param("listId") UUID listId, @Param("lim") int limit);

    /**
     * Số việc gốc CHƯA XONG trong từng danh sách mà người xem thấy được (việc không KPI và không riêng tư, hoặc việc mình
     * liên quan): [list_id, open].
     */
    @Query(value = "SELECT li.list_id, COUNT(*) FROM task_list_items li JOIN kpi_tasks t ON t.id = li.task_id " +
            "WHERE li.list_id IN (:listIds) AND t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') " +
            "  AND ((t.kpi_criteria_id IS NULL AND t.visibility <> 'PRIVATE') OR t.created_by = :me " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) " +
            "       OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me)) " +
            "GROUP BY li.list_id", nativeQuery = true)
    List<Object[]> openCounts(@Param("listIds") Collection<UUID> listIds, @Param("me") UUID me);
}
