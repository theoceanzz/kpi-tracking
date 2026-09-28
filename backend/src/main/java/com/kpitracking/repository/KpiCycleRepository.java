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

    /** Mọi kỳ của MỌI tổ chức kết thúc trong khoảng — cho lượt quét nhắc hạn chốt kỳ. */
    @org.springframework.data.jpa.repository.Query("SELECT c FROM KpiCycle c WHERE c.endDate IS NOT NULL "
           + "AND c.endDate >= :from AND c.endDate <= :to ORDER BY c.endDate ASC")
    java.util.List<KpiCycle> findAllEndingBetween(
            @org.springframework.data.repository.query.Param("from") java.time.Instant from,
            @org.springframework.data.repository.query.Param("to") java.time.Instant to);

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
    // ── Khoá kỳ ──────────────────────────────────────────────────────────────
    // Native + trả về cột vô hướng CÓ CHỦ Ý: nếu đọc qua entity thì Hibernate trả bản đã nằm
    // trong persistence context (nạp từ trước khi chờ khoá) chứ không phải giá trị vừa đọc lại,
    // và thao tác commit sau lúc kỳ khoá sẽ vẫn thấy OPEN.

    /**
     * Đọc trạng thái kỳ và GIỮ khoá chia sẻ tới hết transaction. Mọi thao tác ghi vào kỳ gọi
     * cái này; thủ tục khoá kỳ ({@link #lockForUpdate}) phải chờ tất cả chúng commit, và ngược lại.
     */
    @org.springframework.data.jpa.repository.Query(value =
            "SELECT status FROM kpi_cycles WHERE id = :id AND deleted_at IS NULL FOR SHARE", nativeQuery = true)
    String lockStatusForShare(@org.springframework.data.repository.query.Param("id") UUID id);

    /** Khoá độc quyền hàng kỳ tới hết transaction — mở đầu thủ tục khoá/gia hạn/mở lại. */
    @org.springframework.data.jpa.repository.Query(value =
            "SELECT status FROM kpi_cycles WHERE id = :id AND deleted_at IS NULL FOR UPDATE", nativeQuery = true)
    String lockForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);

    /** Các kỳ CÙNG TỔ CHỨC + CÙNG LOẠI có khoảng thời gian giao với [start, end) — trừ chính nó. */
    @org.springframework.data.jpa.repository.Query("SELECT c FROM KpiCycle c WHERE c.organization.id = :orgId "
            + "AND c.cycleType = :type AND c.id <> :excludeId AND c.startDate IS NOT NULL AND c.endDate IS NOT NULL "
            + "AND c.startDate < :end AND c.endDate > :start ORDER BY c.startDate ASC")
    java.util.List<KpiCycle> findOverlapping(
            @org.springframework.data.repository.query.Param("orgId") UUID orgId,
            @org.springframework.data.repository.query.Param("type") com.kpitracking.enums.KpiFrequency type,
            @org.springframework.data.repository.query.Param("excludeId") UUID excludeId,
            @org.springframework.data.repository.query.Param("start") java.time.Instant start,
            @org.springframework.data.repository.query.Param("end") java.time.Instant end);

    /** Kỳ đích hợp lệ để chuyển đợt: cùng tổ chức + cùng loại + trạng thái cho trước. */
    java.util.List<KpiCycle> findByOrganizationIdAndCycleTypeAndStatusOrderByStartDateAsc(
            UUID organizationId, com.kpitracking.enums.KpiFrequency cycleType, com.kpitracking.enums.KpiCycleStatus status);
}
