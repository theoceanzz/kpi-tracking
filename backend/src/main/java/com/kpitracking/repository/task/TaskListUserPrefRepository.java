package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskListUserPref;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListUserPrefRepository extends JpaRepository<TaskListUserPref, TaskListUserPref.Key> {

    List<TaskListUserPref> findByUserId(UUID userId);
}
