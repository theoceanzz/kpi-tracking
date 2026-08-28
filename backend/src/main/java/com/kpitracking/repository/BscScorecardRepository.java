package com.kpitracking.repository;

import com.kpitracking.entity.BscScorecard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface BscScorecardRepository extends JpaRepository<BscScorecard, UUID> {

    /**
     * Điều kiện "bộ tiêu chí áp dụng cho đợt :periodId":
     * gắn TRỰC TIẾP đợt đó (apply_scope = PERIOD) HOẶC gắn KỲ chứa đợt đó (apply_scope = CYCLE).
     * Vì gắn theo kỳ được suy ra động nên đợt thêm vào kỳ sau này cũng tự áp dụng.
     */
    String APPLIES_TO_PERIOD =
            " AND (EXISTS (SELECT 1 FROM s.kpiPeriods sp WHERE sp.id = :periodId)"
            + " OR c.id = (SELECT pc.kpiCycle.id FROM KpiPeriod pc WHERE pc.id = :periodId)) ";

    List<BscScorecard> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    /** Bộ tiêu chí CHỨA một phòng ban cụ thể và áp dụng cho đợt này (có thể >1 nếu dữ liệu chồng lấn). */
    @Query("SELECT DISTINCT s FROM BscScorecard s JOIN s.orgUnits u LEFT JOIN s.kpiCycle c "
            + "WHERE s.organization.id = :orgId AND u.id = :unitId" + APPLIES_TO_PERIOD)
    List<BscScorecard> findByOrgUnitAndPeriod(@Param("orgId") UUID orgId,
                                              @Param("unitId") UUID unitId,
                                              @Param("periodId") UUID periodId);

    /** Các bộ tiêu chí CHỨA bất kỳ phòng ban nào trong danh sách (dùng để kiểm tra chồng lấn). */
    @Query("SELECT DISTINCT s FROM BscScorecard s JOIN s.orgUnits u LEFT JOIN s.kpiCycle c "
            + "WHERE s.organization.id = :orgId AND u.id IN :unitIds" + APPLIES_TO_PERIOD)
    List<BscScorecard> findByOrgUnitsAndPeriod(@Param("orgId") UUID orgId,
                                               @Param("unitIds") Collection<UUID> unitIds,
                                               @Param("periodId") UUID periodId);

    /** Bộ tiêu chí MẶC ĐỊNH toàn org (không gắn phòng ban nào) áp dụng cho đợt này. */
    @Query("SELECT DISTINCT s FROM BscScorecard s LEFT JOIN s.kpiCycle c "
            + "WHERE s.organization.id = :orgId AND s.orgUnits IS EMPTY" + APPLIES_TO_PERIOD)
    List<BscScorecard> findDefaultByPeriod(@Param("orgId") UUID orgId, @Param("periodId") UUID periodId);

    /** Số bộ tiêu chí (theo phòng ban hoặc mặc định) áp dụng cho org + đợt. */
    @Query("SELECT COUNT(DISTINCT s) FROM BscScorecard s LEFT JOIN s.kpiCycle c "
            + "WHERE s.organization.id = :orgId" + APPLIES_TO_PERIOD)
    long countAppliedToPeriod(@Param("orgId") UUID orgId, @Param("periodId") UUID periodId);
}
