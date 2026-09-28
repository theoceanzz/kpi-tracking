package com.kpitracking.repository;

import com.kpitracking.entity.KpiApprovalEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface KpiApprovalEventRepository extends JpaRepository<KpiApprovalEvent, UUID> {

    List<KpiApprovalEvent> findByFlowIdInOrderByCreatedAtAsc(Collection<UUID> flowIds);
}
