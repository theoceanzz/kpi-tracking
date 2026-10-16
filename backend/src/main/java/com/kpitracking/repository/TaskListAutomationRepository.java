package com.kpitracking.repository;

import com.kpitracking.entity.TaskListAutomation;
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
public interface TaskListAutomationRepository extends JpaRepository<TaskListAutomation, UUID> {

    List<TaskListAutomation> findByListIdOrderByCreatedAtAsc(UUID listId);

    List<TaskListAutomation> findByListIdInAndEnabledTrue(Collection<UUID> listIds);

    /** Đếm lượt chạy — câu UPDATE thẳng, không đụng entity đang nạp. */
    @Modifying
    @Query("UPDATE TaskListAutomation a SET a.runCount = a.runCount + 1, a.lastRunAt = :at WHERE a.id = :id")
    void markRun(@Param("id") UUID id, @Param("at") Instant at);
}
