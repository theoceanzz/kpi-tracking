package com.kpitracking.repository;

import com.kpitracking.entity.TaskListUserPref;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListUserPrefRepository extends JpaRepository<TaskListUserPref, TaskListUserPref.Key> {

    List<TaskListUserPref> findByUserId(UUID userId);
}
