package com.kpitracking.repository;

import com.kpitracking.entity.CashTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CashTransactionRepository extends JpaRepository<CashTransaction, UUID> {

    /** Lớp 1 của cơ chế chống ghi trùng. Xem {@code CashWalletService.applyTransaction}. */
    Optional<CashTransaction> findByIdempotencyKey(String idempotencyKey);

    Page<CashTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    Page<CashTransaction> findByOrganizationIdAndUserIdOrderByCreatedAtDesc(
            UUID organizationId, UUID userId, Pageable pageable);
}
