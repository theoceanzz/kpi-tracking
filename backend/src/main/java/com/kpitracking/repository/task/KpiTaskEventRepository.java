package com.kpitracking.repository.task;

import com.kpitracking.entity.task.KpiTaskEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskEventRepository extends JpaRepository<KpiTaskEvent, UUID> {

    List<KpiTaskEvent> findByTaskIdOrderByCreatedAtDesc(UUID taskId);

    /**
     * Trang "Hoạt động" (Lark: Activities): thay đổi của các việc mình TẠO, PHỤ TRÁCH hoặc THEO DÕI — ba vai trò luôn xem được
     * việc — mới nhất trước.
     */
    @Query(value = "SELECT e.* FROM kpi_task_events e JOIN kpi_tasks t ON t.id = e.task_id "
            + "WHERE t.deleted_at IS NULL AND t.organization_id = :org AND (t.created_by = :me "
            + "OR EXISTS (SELECT 1 FROM kpi_task_assignees a WHERE a.task_id = t.id AND a.user_id = :me) "
            + "OR EXISTS (SELECT 1 FROM kpi_task_followers f WHERE f.task_id = t.id AND f.user_id = :me)) "
            + "ORDER BY e.created_at DESC, e.id LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<KpiTaskEvent> myFeed(@Param("org") UUID org, @Param("me") UUID me, @Param("limit") int limit, @Param("offset") int offset);

    /** Hoạt động của một danh sách việc (tab "Hoạt động" của danh sách); người gọi lọc tiếp theo luật xem việc. */
    @Query(value = "SELECT e.* FROM kpi_task_events e JOIN kpi_tasks t ON t.id = e.task_id "
            + "JOIN task_list_items li ON li.task_id = t.id AND li.list_id = :listId "
            + "WHERE t.deleted_at IS NULL ORDER BY e.created_at DESC, e.id LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<KpiTaskEvent> listFeed(@Param("listId") UUID listId, @Param("limit") int limit, @Param("offset") int offset);
}
