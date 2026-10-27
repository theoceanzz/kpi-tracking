package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskListSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListSectionRepository extends JpaRepository<TaskListSection, UUID> {

    List<TaskListSection> findByListIdOrderBySortOrderAscCreatedAtAsc(UUID listId);

    List<TaskListSection> findByListIdIn(Collection<UUID> listIds);

    @Query("SELECT COALESCE(MAX(s.sortOrder), 0) FROM TaskListSection s WHERE s.listId = :listId")
    double maxSortOrder(@Param("listId") UUID listId);
}
