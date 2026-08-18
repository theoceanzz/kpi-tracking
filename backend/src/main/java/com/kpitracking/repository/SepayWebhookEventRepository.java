package com.kpitracking.repository;

import com.kpitracking.entity.SepayWebhookEvent;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SepayWebhookEventRepository extends JpaRepository<SepayWebhookEvent, UUID> {

    boolean existsBySepayId(Long sepayId);

    /**
     * Khoá dòng sự kiện trước khi đóng nó. Tiền vốn đã an toàn nhờ khoá chống ghi
     * trùng ở sổ cái, nhưng hai người cùng bấm xử lý trước khi transaction đầu
     * commit sẽ cùng đọc được {@code resolvedAt IS NULL} và cùng ghi — người thua
     * cuộc ghi đè {@code resolvedBy}/{@code resolutionNote} của người thắng, tức
     * hỏng đúng thứ mà nhóm cột này sinh ra để giữ.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM SepayWebhookEvent e WHERE e.id = :id")
    Optional<SepayWebhookEvent> findByIdForUpdate(@Param("id") UUID id);

    /**
     * HÀNG ĐỢI ĐỐI SOÁT. Điều kiện phải khớp đúng
     * {@code idx_sepay_events_queue} và {@code SepayWebhookEvent.isInReconcileQueue()}.
     */
    @Query("""
            SELECT e FROM SepayWebhookEvent e
             WHERE e.resolvedAt IS NULL
               AND (e.status = com.kpitracking.enums.SepayEventStatus.UNMATCHED
                    OR e.amountMismatch = TRUE)
             ORDER BY e.receivedAt DESC
            """)
    Page<SepayWebhookEvent> findReconcileQueue(Pageable pageable);

    @Query("""
            SELECT COUNT(e) FROM SepayWebhookEvent e
             WHERE e.resolvedAt IS NULL
               AND e.status = com.kpitracking.enums.SepayEventStatus.UNMATCHED
            """)
    long countUnresolved();

    @Query("""
            SELECT COUNT(e) FROM SepayWebhookEvent e
             WHERE e.resolvedAt IS NULL AND e.amountMismatch = TRUE
            """)
    long countAmountMismatch();

    Page<SepayWebhookEvent> findAllByOrderByReceivedAtDesc(Pageable pageable);
}
