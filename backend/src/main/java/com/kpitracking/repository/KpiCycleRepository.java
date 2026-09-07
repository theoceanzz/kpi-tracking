package com.kpitracking.repository;

import com.kpitracking.entity.KpiCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KpiCycleRepository extends JpaRepository<KpiCycle, UUID>, JpaSpecificationExecutor<KpiCycle> {

    /** Dùng bởi bộ tự động phát thưởng để quét các kỳ đã kết thúc. */
    java.util.List<KpiCycle> findByOrganizationId(UUID organizationId);

    /** Số đợt (chưa xoá) đang thuộc kỳ này. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT COUNT(p) FROM KpiPeriod p WHERE p.kpiCycle.id = :cycleId AND p.deletedAt IS NULL")
    long countPeriods(@org.springframework.data.repository.query.Param("cycleId") UUID cycleId);

    /** Các kỳ của tổ chức, mới nhất trước — biểu đồ biến động thứ hạng lấy hai kỳ đầu để so. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT c FROM KpiCycle c WHERE c.organization.id = :orgId AND c.deletedAt IS NULL " +
            "ORDER BY c.startDate DESC")
    java.util.List<KpiCycle> findByOrganizationIdOrderByStartDateDesc(
            @org.springframework.data.repository.query.Param("orgId") UUID orgId);
}
