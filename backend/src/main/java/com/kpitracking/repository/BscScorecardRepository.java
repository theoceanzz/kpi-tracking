package com.kpitracking.repository;

import com.kpitracking.entity.BscScorecard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscScorecardRepository extends JpaRepository<BscScorecard, UUID> {

    List<BscScorecard> findByOrganizationIdOrderByCreatedAtDesc(UUID organizationId);

    /** Bộ tiêu chí CHỨA một phòng ban cụ thể trong 1 kỳ. */
    @Query("SELECT s FROM BscScorecard s JOIN s.orgUnits u "
            + "WHERE s.organization.id = :orgId AND s.kpiPeriod.id = :periodId AND u.id = :unitId")
    Optional<BscScorecard> findByOrgUnitAndPeriod(@Param("orgId") UUID orgId,
                                                  @Param("unitId") UUID unitId,
                                                  @Param("periodId") UUID periodId);

    /** Các bộ tiêu chí CHỨA bất kỳ phòng ban nào trong danh sách (dùng để kiểm tra chồng lấn). */
    @Query("SELECT DISTINCT s FROM BscScorecard s JOIN s.orgUnits u "
            + "WHERE s.organization.id = :orgId AND s.kpiPeriod.id = :periodId AND u.id IN :unitIds")
    List<BscScorecard> findByOrgUnitsAndPeriod(@Param("orgId") UUID orgId,
                                               @Param("unitIds") Collection<UUID> unitIds,
                                               @Param("periodId") UUID periodId);

    /** Bộ tiêu chí MẶC ĐỊNH toàn org (không gắn phòng ban nào) trong 1 kỳ. */
    @Query("SELECT s FROM BscScorecard s "
            + "WHERE s.organization.id = :orgId AND s.kpiPeriod.id = :periodId AND s.orgUnits IS EMPTY")
    Optional<BscScorecard> findDefaultByPeriod(@Param("orgId") UUID orgId, @Param("periodId") UUID periodId);

    /** Có BẤT KỲ bộ tiêu chí nào (theo phòng ban hoặc mặc định) cho org+kỳ không. */
    boolean existsByOrganizationIdAndKpiPeriodId(UUID organizationId, UUID kpiPeriodId);
}
