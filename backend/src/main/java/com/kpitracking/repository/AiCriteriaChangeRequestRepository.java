package com.kpitracking.repository;

import com.kpitracking.entity.AiCriteriaChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiCriteriaChangeRequestRepository extends JpaRepository<AiCriteriaChangeRequest, UUID> {

    List<AiCriteriaChangeRequest> findByOrganizationIdAndStatusOrderByCreatedAtDesc(UUID organizationId, String status);

    Optional<AiCriteriaChangeRequest> findByProposedSetIdAndStatus(UUID proposedSetId, String status);

    Optional<AiCriteriaChangeRequest> findByIdAndOrganizationId(UUID id, UUID organizationId);
}
