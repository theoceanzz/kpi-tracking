package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskReminderRepository extends JpaRepository<KpiTaskReminder, UUID> {

    List<KpiTaskReminder> findByTaskIdOrderByCreatedAtAsc(UUID taskId);

    List<KpiTaskReminder> findByTaskIdIn(Collection<UUID> taskIds);

    @Modifying
    @Query("DELETE FROM KpiTaskReminder r WHERE r.taskId = :taskId")
    void deleteByTaskId(@Param("taskId") UUID taskId);

    /**
     * Mốc nhắc tới giờ, chưa gửi, trong cửa sổ {@code since..now} (mốc quá cũ — vd. máy chủ tắt nhiều ngày — thì bỏ,
     * không dội nhắc muộn). Chỉ task chưa xong, KPI còn, kỳ chưa khoá, người phụ trách còn hoạt động.
     */
    @Query(value = "SELECT r.* FROM kpi_task_reminders r " +
            "JOIN kpi_tasks t ON t.id = r.task_id AND t.deleted_at IS NULL AND t.status IN ('TODO', 'IN_PROGRESS') " +
            "JOIN users u ON u.id = t.owner_id AND u.deleted_at IS NULL AND u.status = 'ACTIVE' " +
            "JOIN kpi_criteria k ON k.id = t.kpi_criteria_id AND k.deleted_at IS NULL AND k.status <> 'CLOSED_BY_LOCK' " +
            "LEFT JOIN kpi_periods p ON p.id = k.kpi_period_id " +
            "LEFT JOIN kpi_cycles c ON c.id = p.kpi_cycle_id " +
            "WHERE r.sent_at IS NULL AND r.remind_at <= :now AND r.remind_at > :since " +
            "  AND (c.status IS NULL OR c.status <> 'LOCKED') " +
            "ORDER BY r.remind_at LIMIT :lim", nativeQuery = true)
    List<KpiTaskReminder> findDue(@Param("now") Instant now, @Param("since") Instant since, @Param("lim") int limit);

    /** Đánh dấu đã gửi — chỉ khi chưa ai đánh dấu (hai máy chủ cùng chạy job thì chỉ một gửi). */
    @Modifying
    @Query(value = "UPDATE kpi_task_reminders SET sent_at = :at WHERE id = :id AND sent_at IS NULL", nativeQuery = true)
    int markSent(@Param("id") UUID id, @Param("at") Instant at);
}
