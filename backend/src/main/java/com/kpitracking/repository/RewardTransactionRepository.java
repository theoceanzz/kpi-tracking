package com.kpitracking.repository;

import com.kpitracking.entity.RewardTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RewardTransactionRepository extends JpaRepository<RewardTransaction, UUID> {

    /**
     * Tra giao dịch theo khoá chống trùng. Khi gặp lỗi vi phạm ràng buộc duy nhất,
     * service dùng hàm này để trả lại chính giao dịch đã ghi (lần gọi lặp là no-op),
     * thay vì báo lỗi — retry mạng bình thường không nên hiện thành lỗi đỏ cho người dùng.
     */
    Optional<RewardTransaction> findByIdempotencyKey(String idempotencyKey);

    Page<RewardTransaction> findByUserIdAndOrganizationIdOrderByCreatedAtDesc(
            UUID userId, UUID organizationId, Pageable pageable);

    Page<RewardTransaction> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId, Pageable pageable);

    List<RewardTransaction> findBySourceRefId(UUID sourceRefId);
}
