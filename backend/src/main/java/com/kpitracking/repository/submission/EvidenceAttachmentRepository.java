package com.kpitracking.repository.submission;

import com.kpitracking.entity.submission.EvidenceAttachment;
import com.kpitracking.enums.submission.EvidenceTargetType;
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
