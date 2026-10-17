package com.kpitracking.repository;

import com.kpitracking.entity.TaskListItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListItemRepository extends JpaRepository<TaskListItem, TaskListItem.Key> {

    List<TaskListItem> findByTaskId(UUID taskId);

    List<TaskListItem> findByTaskIdIn(Collection<UUID> taskIds);

    List<TaskListItem> findByListId(UUID listId);

    @Query("SELECT COALESCE(MAX(i.sortOrder), 0) FROM TaskListItem i WHERE i.listId = :listId")
    double maxSortOrder(@Param("listId") UUID listId);

    @Modifying
    @Query("UPDATE TaskListItem i SET i.sectionId = NULL WHERE i.sectionId = :sectionId")
    void clearSection(@Param("sectionId") UUID sectionId);

    @Modifying
    @Query("DELETE FROM TaskListItem i WHERE i.listId = :listId AND i.taskId = :taskId")
    int deleteOne(@Param("listId") UUID listId, @Param("taskId") UUID taskId);
}
