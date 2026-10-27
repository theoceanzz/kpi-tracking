package com.kpitracking.repository.task;

import com.kpitracking.entity.task.KpiTaskAttachment;
import com.kpitracking.enums.task.KpiTaskAttachmentKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiTaskAttachmentRepository extends JpaRepository<KpiTaskAttachment, UUID> {

    List<KpiTaskAttachment> findByTaskIdOrderByCreatedAtAsc(UUID taskId);

    List<KpiTaskAttachment> findByTaskIdIn(Collection<UUID> taskIds);

    int countByTaskIdAndKind(UUID taskId, KpiTaskAttachmentKind kind);
}
