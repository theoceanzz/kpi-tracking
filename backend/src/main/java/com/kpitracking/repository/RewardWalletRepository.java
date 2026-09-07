package com.kpitracking.repository;

import com.kpitracking.entity.RewardWallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardWalletRepository extends JpaRepository<RewardWallet, UUID> {

    Optional<RewardWallet> findByOrganizationIdAndUserId(UUID organizationId, UUID userId);

    /**
     * Nạp ví kèm KHOÁ BI QUAN dòng — đây là cơ chế chính chống đua ghi, không phải
     * cột {@code version}. Khoá lạc quan trên một dòng chắc chắn bị tranh chấp
     * (ví của một người, nhiều luồng cùng cộng/trừ) chỉ đẩy mọi caller vào vòng retry.
     *
     * <p>CHỈ {@code RewardWalletService.applyTransaction} được gọi hàm này.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM RewardWallet w WHERE w.id = :id")
    Optional<RewardWallet> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            SELECT w FROM RewardWallet w
             WHERE w.organization.id = :orgId
               AND (CAST(:keyword AS string) IS NULL
                    OR LOWER(CAST(w.user.fullName AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))
                    OR LOWER(CAST(w.user.email AS string)) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')))
            """)
    Page<RewardWallet> searchByOrg(@Param("orgId") UUID orgId,
                                   @Param("keyword") String keyword,
                                   Pageable pageable);

    List<RewardWallet> findByOrganizationIdAndUserIdIn(UUID organizationId, List<UUID> userIds);

    /**
     * Đối soát: trả về các ví có số dư lệch so với tổng sổ cái. Phải luôn rỗng.
     * Dùng cho endpoint kiểm tra sức khoẻ dữ liệu và cho kịch bản kiểm thử.
     */
    @Query(value = """
            SELECT w.id
              FROM reward_wallets w
              LEFT JOIN reward_transactions t ON t.wallet_id = w.id
             WHERE w.deleted_at IS NULL
             GROUP BY w.id, w.balance, w.lifetime_earned, w.lifetime_spent, w.lifetime_expired
            HAVING w.balance <> COALESCE(SUM(t.amount), 0)
                OR w.balance <> w.lifetime_earned - w.lifetime_spent - w.lifetime_expired
            """, nativeQuery = true)
    List<UUID> findInconsistentWalletIds();
}
