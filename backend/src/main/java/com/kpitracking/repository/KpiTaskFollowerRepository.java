package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskFollower;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskFollowerRepository extends JpaRepository<KpiTaskFollower, KpiTaskFollower.Key> {

    List<KpiTaskFollower> findByTaskIdIn(Collection<UUID> taskIds);

    List<KpiTaskFollower> findByTaskId(UUID taskId);

    boolean existsByTaskIdAndUserId(UUID taskId, UUID userId);

    @Query("SELECT f.userId FROM KpiTaskFollower f WHERE f.taskId = :taskId")
    List<UUID> findUserIds(@Param("taskId") UUID taskId);
}
