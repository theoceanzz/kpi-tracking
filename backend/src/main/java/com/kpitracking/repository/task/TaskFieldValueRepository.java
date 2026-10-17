package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskFieldValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskFieldValueRepository extends JpaRepository<TaskFieldValue, TaskFieldValue.Key> {

    List<TaskFieldValue> findByTaskIdIn(Collection<UUID> taskIds);

    List<TaskFieldValue> findByTaskId(UUID taskId);

    @Modifying
    @Query("DELETE FROM TaskFieldValue v WHERE v.taskId = :taskId AND v.fieldId IN :fieldIds")
    void deleteByTaskAndFields(@Param("taskId") UUID taskId, @Param("fieldIds") Collection<UUID> fieldIds);
}
