package com.kpitracking.repository;

import com.kpitracking.entity.ApprovalProcess;
import com.kpitracking.enums.ApprovalObjectType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApprovalProcessRepository extends JpaRepository<ApprovalProcess, UUID> {

    /** {@code keyword} đã được phía gọi hạ chữ thường và bọc {@code %…%} (không lọc = {@code "%"}). */
    @Query(value = "SELECT p FROM ApprovalProcess p WHERE p.organizationId = :orgId " +
                   "AND (:objectType IS NULL OR p.objectType = :objectType) " +
                   "AND LOWER(p.title) LIKE :keyword",
           countQuery = "SELECT COUNT(p) FROM ApprovalProcess p WHERE p.organizationId = :orgId " +
                        "AND (:objectType IS NULL OR p.objectType = :objectType) " +
                        "AND LOWER(p.title) LIKE :keyword")
    Page<ApprovalProcess> search(@Param("orgId") UUID orgId,
                                 @Param("objectType") ApprovalObjectType objectType,
                                 @Param("keyword") String keyword,
                                 Pageable pageable);

    List<ApprovalProcess> findByOrganizationIdAndObjectTypeAndActiveTrue(UUID organizationId, ApprovalObjectType objectType);

    Optional<ApprovalProcess> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<ApprovalProcess> findByIdInAndOrganizationId(Collection<UUID> ids, UUID organizationId);
}
