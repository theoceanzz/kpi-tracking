package com.kpitracking.repository;

import com.kpitracking.entity.KeyResultUnitWeight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KeyResultUnitWeightRepository extends JpaRepository<KeyResultUnitWeight, UUID> {
    void deleteByKeyResultId(UUID keyResultId);

    /**
     * Luồng OKR: Mục tiêu → Key Result → Đơn vị, độ dày là trọng số phân bổ.
     * → [tenMucTieu, tenKeyResult, tenDonVi, trongSo].
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT o.name, kr.name, ou.name, krw.weightPercentage " +
        "FROM KeyResultUnitWeight krw JOIN krw.keyResult kr JOIN kr.objective o JOIN krw.orgUnit ou " +
        "WHERE ou.id IN :unitIds AND krw.weightPercentage > 0 " +
        "ORDER BY o.name, kr.name")
    java.util.List<Object[]> okrFlowEdges(
        @org.springframework.data.repository.query.Param("unitIds") java.util.Collection<java.util.UUID> unitIds);
}
