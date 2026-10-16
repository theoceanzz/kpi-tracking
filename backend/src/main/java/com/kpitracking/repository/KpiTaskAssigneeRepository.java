package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskAssignee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskAssigneeRepository extends JpaRepository<KpiTaskAssignee, KpiTaskAssignee.Key> {

    List<KpiTaskAssignee> findByTaskIdOrderByAddedAtAsc(UUID taskId);

    List<KpiTaskAssignee> findByTaskIdIn(Collection<UUID> taskIds);

    boolean existsByTaskIdAndUserId(UUID taskId, UUID userId);

    @Query("SELECT a.userId FROM KpiTaskAssignee a WHERE a.taskId = :taskId ORDER BY a.addedAt")
    List<UUID> findUserIds(@Param("taskId") UUID taskId);

    /** Có người thực hiện nào của các việc này là {@code userId} không (dùng cho luật "người của việc tổ tiên"). */
    @Query("SELECT COUNT(a) > 0 FROM KpiTaskAssignee a WHERE a.taskId IN :taskIds AND a.userId = :userId")
    boolean anyAssigned(@Param("taskIds") Collection<UUID> taskIds, @Param("userId") UUID userId);

    @Modifying
    @Query("DELETE FROM KpiTaskAssignee a WHERE a.taskId = :taskId AND a.userId = :userId")
    int deleteOne(@Param("taskId") UUID taskId, @Param("userId") UUID userId);

    /** Mở lại việc: mọi phần đã tích về rỗng (không tăng version của việc). */
    @Modifying
    @Query("UPDATE KpiTaskAssignee a SET a.completedAt = NULL WHERE a.taskId = :taskId")
    void clearCompletion(@Param("taskId") UUID taskId);
}
