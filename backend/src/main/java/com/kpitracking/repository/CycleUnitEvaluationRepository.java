package com.kpitracking.repository;

import com.kpitracking.entity.CycleUnitEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycleUnitEvaluationRepository extends JpaRepository<CycleUnitEvaluation, UUID> {

    Optional<CycleUnitEvaluation> findByKpiCycleIdAndOrgUnitId(UUID kpiCycleId, UUID orgUnitId);

    /** Mọi bản tổng hợp phòng ban của một kỳ — dùng để kiểm tra đã chốt hay chưa. */
    java.util.List<CycleUnitEvaluation> findByKpiCycleId(UUID kpiCycleId);

    /**
     * Điểm chốt kỳ của các đơn vị trong phạm vi — dùng cho biến động thứ hạng và biểu đồ
     * tự đánh giá vs quản lý đánh giá.
     * → [orgUnitId, orgUnitName, selfScore, managerScore, qualScore, matrixRating, memberCount].
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT ou.id, ou.name, c.selfScore, c.managerScore, c.qualScore, c.matrixRating, c.memberCount " +
        "FROM CycleUnitEvaluation c JOIN c.orgUnit ou " +
        "WHERE c.kpiCycle.id = :cycleId AND ou.id IN :unitIds")
    java.util.List<Object[]> scoresByCycleAndUnits(
        @org.springframework.data.repository.query.Param("cycleId") UUID cycleId,
        @org.springframework.data.repository.query.Param("unitIds") java.util.Collection<UUID> unitIds);
}
