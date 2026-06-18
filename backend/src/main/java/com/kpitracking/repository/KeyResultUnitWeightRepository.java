package com.kpitracking.repository;

import com.kpitracking.entity.KeyResultUnitWeight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface KeyResultUnitWeightRepository extends JpaRepository<KeyResultUnitWeight, UUID> {
    void deleteByKeyResultId(UUID keyResultId);
}
