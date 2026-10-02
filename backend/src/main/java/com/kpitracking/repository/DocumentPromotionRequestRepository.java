package com.kpitracking.repository;

import com.kpitracking.entity.DocumentPromotionRequest;
import com.kpitracking.entity.DocumentPromotionRequest.Status;
import com.kpitracking.enums.DocumentScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentPromotionRequestRepository extends JpaRepository<DocumentPromotionRequest, UUID> {

    Optional<DocumentPromotionRequest> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<DocumentPromotionRequest> findByOrganizationIdAndStatusOrderByCreatedAtAsc(UUID organizationId, Status status);

    List<DocumentPromotionRequest> findTop50ByOrganizationIdAndRequestedByOrderByCreatedAtDesc(UUID organizationId, UUID requestedBy);

    List<DocumentPromotionRequest> findByDocumentIdAndStatus(UUID documentId, Status status);

    boolean existsByDocumentIdAndTargetScopeAndTargetUnitIdAndStatus(UUID documentId, DocumentScope targetScope,
                                                                    UUID targetUnitId, Status status);

    /**
     * Giành quyền quyết định: chỉ một người duyệt thắng ({@code PENDING → to}). Trả 0 khi người khác đã quyết trước —
     * hai người duyệt bấm cùng lúc không sinh hai bản sao.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE DocumentPromotionRequest r SET r.status = :to, r.decidedBy = :by, r.decidedAt = :at, r.decisionNote = :note
             WHERE r.id = :id AND r.status = com.kpitracking.entity.DocumentPromotionRequest.Status.PENDING
            """)
    int decide(@Param("id") UUID id, @Param("to") Status to, @Param("by") UUID by, @Param("at") Instant at,
               @Param("note") String note);
}
