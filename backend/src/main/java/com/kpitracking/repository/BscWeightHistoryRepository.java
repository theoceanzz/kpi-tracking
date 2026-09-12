package com.kpitracking.repository;

import com.kpitracking.entity.BscWeightHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscWeightHistoryRepository extends JpaRepository<BscWeightHistory, UUID> {

    List<BscWeightHistory> findByScorecardIdOrderByChangedAtDesc(UUID scorecardId);

    /**
     * Toàn bộ lần đổi trọng số của một tổ chức, cũ đến mới — cho biểu đồ đường bậc thang.
     * → [changedAt, perspectiveId, perspectiveName, color, oldWeight, newWeight, reason, nguoiDoi].
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT h.changedAt, p.id, p.name, p.color, h.oldWeight, h.newWeight, h.reason, u.fullName " +
        "FROM BscWeightHistory h JOIN h.scorecard sc JOIN h.perspective p LEFT JOIN h.changedBy u " +
        "WHERE sc.organization.id = :orgId ORDER BY h.changedAt")
    List<Object[]> weightTimelineByOrg(@org.springframework.data.repository.query.Param("orgId") UUID orgId);
}
