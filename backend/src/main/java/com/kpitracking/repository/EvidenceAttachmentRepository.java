package com.kpitracking.repository;

import com.kpitracking.entity.EvidenceAttachment;
import com.kpitracking.enums.EvidenceTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EvidenceAttachmentRepository extends JpaRepository<EvidenceAttachment, UUID> {

    List<EvidenceAttachment> findByOrganizationIdAndTargetTypeAndTargetKeyOrderByCreatedAtAsc(
            UUID organizationId, EvidenceTargetType targetType, String targetKey);

    int countByOrganizationIdAndTargetTypeAndTargetKey(UUID organizationId, EvidenceTargetType targetType, String targetKey);
}
