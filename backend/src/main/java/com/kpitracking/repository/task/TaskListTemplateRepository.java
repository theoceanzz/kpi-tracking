package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskListTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskListTemplateRepository extends JpaRepository<TaskListTemplate, UUID> {

    List<TaskListTemplate> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
}
