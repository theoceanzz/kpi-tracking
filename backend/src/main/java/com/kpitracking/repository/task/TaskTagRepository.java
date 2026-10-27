package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TaskTagRepository extends JpaRepository<TaskTag, UUID> {

    List<TaskTag> findByOrganizationIdOrderByNameAsc(UUID organizationId);

    @Query("SELECT t FROM TaskTag t WHERE t.organizationId = :orgId AND LOWER(t.name) = LOWER(:name)")
    Optional<TaskTag> findByName(@Param("orgId") UUID organizationId, @Param("name") String name);
}
