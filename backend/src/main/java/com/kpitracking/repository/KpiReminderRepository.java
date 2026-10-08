package com.kpitracking.repository;

import com.kpitracking.entity.KpiReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KpiReminderRepository extends JpaRepository<KpiReminder, UUID> {
    Optional<KpiReminder> findByKpiCriteriaIdAndUserIdAndBatchNumber(UUID kpiCriteriaId, UUID userId, Integer batchNumber);

    /** Các lời nhắc hạn đã gửi của loạt KPI: hàng = [kpiId, userId, batchNumber]. */
    @Query("SELECT r.kpiCriteria.id, r.user.id, r.batchNumber FROM KpiReminder r WHERE r.kpiCriteria.id IN :kpiIds")
    List<Object[]> findSentKeys(@Param("kpiIds") Collection<UUID> kpiIds);
}
