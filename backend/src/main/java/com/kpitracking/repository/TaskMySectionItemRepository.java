package com.kpitracking.repository;

import com.kpitracking.entity.TaskMySectionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskMySectionItemRepository extends JpaRepository<TaskMySectionItem, TaskMySectionItem.Key> {

    List<TaskMySectionItem> findByUserIdAndTaskIdIn(UUID userId, Collection<UUID> taskIds);
}
