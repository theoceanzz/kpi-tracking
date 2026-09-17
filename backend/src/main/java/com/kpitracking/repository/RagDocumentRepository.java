package com.kpitracking.repository;

import com.kpitracking.entity.RagDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RagDocumentRepository extends JpaRepository<RagDocument, UUID> {
    List<RagDocument> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);
    List<RagDocument> findByOrganizationIdIsNullOrderByCreatedAtDesc();
    Optional<RagDocument> findFirstBySourceAndOrganizationIdIsNull(RagDocument.Source source);
}
