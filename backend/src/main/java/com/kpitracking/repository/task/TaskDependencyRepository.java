package com.kpitracking.repository.task;

import com.kpitracking.entity.task.TaskDependency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface TaskDependencyRepository extends JpaRepository<TaskDependency, UUID> {

    List<TaskDependency> findBySuccessorId(UUID successorId);

    List<TaskDependency> findByPredecessorId(UUID predecessorId);

    @Query("SELECT d FROM TaskDependency d WHERE d.successorId IN :ids OR d.predecessorId IN :ids")
    List<TaskDependency> touching(@Param("ids") Collection<UUID> taskIds);

    boolean existsByPredecessorIdAndSuccessorId(UUID predecessorId, UUID successorId);

    /** Số việc đứng trước (còn hiệu lực) chưa xong của một việc. */
    @Query(value = "SELECT COUNT(*) FROM task_dependencies d JOIN kpi_tasks p ON p.id = d.predecessor_id " +
            "WHERE d.successor_id = :id AND p.deleted_at IS NULL AND p.status IN ('TODO', 'IN_PROGRESS')", nativeQuery = true)
    long countOpenBlockers(@Param("id") UUID successorId);

    /** Số việc đứng trước chưa xong theo từng việc: [successor_id, count]. */
    @Query(value = "SELECT d.successor_id, COUNT(*) FROM task_dependencies d JOIN kpi_tasks p ON p.id = d.predecessor_id " +
            "WHERE d.successor_id IN (:ids) AND p.deleted_at IS NULL AND p.status IN ('TODO', 'IN_PROGRESS') " +
            "GROUP BY d.successor_id", nativeQuery = true)
    List<Object[]> openBlockerCounts(@Param("ids") Collection<UUID> successorIds);

    /** Có đường đi from → … → to không (để chặn vòng khi thêm to → from). */
    @Query(value = "WITH RECURSIVE r(id) AS (SELECT CAST(:from AS uuid) UNION " +
            "  SELECT d.successor_id FROM task_dependencies d JOIN r ON d.predecessor_id = r.id) " +
            "SELECT EXISTS (SELECT 1 FROM r WHERE id = :to)", nativeQuery = true)
    boolean reachable(@Param("from") UUID from, @Param("to") UUID to);
}
