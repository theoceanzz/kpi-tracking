package com.kpitracking.repository;

import com.kpitracking.entity.TaskListMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TaskListMemberRepository extends JpaRepository<TaskListMember, UUID> {

    List<TaskListMember> findByListIdOrderByAddedAtAsc(UUID listId);

    List<TaskListMember> findByListIdIn(Collection<UUID> listIds);

    Optional<TaskListMember> findByListIdAndUserId(UUID listId, UUID userId);

    Optional<TaskListMember> findByListIdAndOrgUnitId(UUID listId, UUID orgUnitId);
}
