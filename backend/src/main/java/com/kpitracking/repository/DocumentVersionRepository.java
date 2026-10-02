package com.kpitracking.repository;

import com.kpitracking.entity.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {

    List<DocumentVersion> findByDocumentIdOrderByVersionDesc(UUID documentId);

    Optional<DocumentVersion> findByIdAndDocumentId(UUID id, UUID documentId);
}
