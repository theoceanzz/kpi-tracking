package com.kpitracking.repository;

import com.kpitracking.entity.KpiTaskAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskAttachmentRepository extends JpaRepository<KpiTaskAttachment, UUID> {

    List<KpiTaskAttachment> findByTaskIdOrderByCreatedAtAsc(UUID taskId);

    List<KpiTaskAttachment> findByTaskIdIn(Collection<UUID> taskIds);

    int countByTaskId(UUID taskId);
}
