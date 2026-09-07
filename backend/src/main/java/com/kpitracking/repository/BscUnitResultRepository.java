package com.kpitracking.repository;

import com.kpitracking.entity.BscUnitResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BscUnitResultRepository extends JpaRepository<BscUnitResult, UUID> {

    Optional<BscUnitResult> findByScorecardIdAndKpiPeriodId(UUID scorecardId, UUID kpiPeriodId);

    List<BscUnitResult> findByScorecardIdOrderByCreatedAtDesc(UUID scorecardId);

    /** Mọi kết quả BSC đơn vị của một đợt trong một tổ chức — dùng cho dashboard đối chiếu. */
    @Query("SELECT r FROM BscUnitResult r WHERE r.scorecard.organization.id = :orgId "
            + "AND r.kpiPeriod.id = :periodId")
    List<BscUnitResult> findByOrganizationAndPeriod(@Param("orgId") UUID orgId,
                                                    @Param("periodId") UUID periodId);
}
