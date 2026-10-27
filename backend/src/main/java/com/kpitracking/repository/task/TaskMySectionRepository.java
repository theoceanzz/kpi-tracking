package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskMySection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TaskMySectionRepository extends JpaRepository<TaskMySection, UUID> {

    List<TaskMySection> findByUserIdOrderBySortOrderAscCreatedAtAsc(UUID userId);

    long countByUserId(UUID userId);

    @Query("SELECT COALESCE(MAX(s.sortOrder), 0) FROM TaskMySection s WHERE s.userId = :userId")
    double maxSortOrder(@Param("userId") UUID userId);
}
