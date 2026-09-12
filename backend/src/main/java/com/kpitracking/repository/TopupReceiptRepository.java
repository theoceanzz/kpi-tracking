package com.kpitracking.repository;

import com.kpitracking.entity.TopupReceipt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TopupReceiptRepository extends JpaRepository<TopupReceipt, UUID> {

    Optional<TopupReceipt> findByTopupOrderId(UUID topupOrderId);

    boolean existsByTopupOrderId(UUID topupOrderId);

    Page<TopupReceipt> findByOrganizationIdAndUserIdOrderByNumberDesc(
            UUID organizationId, UUID userId, Pageable pageable);

    Page<TopupReceipt> findByOrganizationIdOrderByNumberDesc(UUID organizationId, Pageable pageable);
}
