package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskListField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListFieldRepository extends JpaRepository<TaskListField, UUID> {

    List<TaskListField> findByListIdOrderBySortOrderAscCreatedAtAsc(UUID listId);

    List<TaskListField> findByListIdIn(Collection<UUID> listIds);

    @Query("SELECT COALESCE(MAX(f.sortOrder), 0) FROM TaskListField f WHERE f.listId = :listId")
    double maxSortOrder(@Param("listId") UUID listId);
}
