package com.kpitracking.repository;

import com.kpitracking.entity.TaskTagLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskTagLinkRepository extends JpaRepository<TaskTagLink, TaskTagLink.Key> {

    List<TaskTagLink> findByTaskIdIn(Collection<UUID> taskIds);

    List<TaskTagLink> findByTaskId(UUID taskId);

    @Modifying
    @Query("DELETE FROM TaskTagLink l WHERE l.taskId = :taskId")
    void deleteByTaskId(@Param("taskId") UUID taskId);
}
