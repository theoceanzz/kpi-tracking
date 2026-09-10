package com.kpitracking.repository;

import com.kpitracking.entity.TopupReceiptCounter;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TopupReceiptCounterRepository extends JpaRepository<TopupReceiptCounter, UUID> {

    /**
     * Khoá dòng đếm trước khi cấp số. Đây là điểm tuần tự hoá duy nhất bảo đảm số chứng từ
     * không trùng và không nhảy cóc khi nhiều webhook về cùng lúc.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM TopupReceiptCounter c WHERE c.organizationId = :orgId AND c.series = :series")
    Optional<TopupReceiptCounter> findForUpdate(@Param("orgId") UUID orgId, @Param("series") String series);

    /** Đọc không khoá — dùng để kiểm tra "đã phát chứng từ nào chưa", không phải để cấp số. */
    Optional<TopupReceiptCounter> findByOrganizationIdAndSeries(UUID organizationId, String series);
}
