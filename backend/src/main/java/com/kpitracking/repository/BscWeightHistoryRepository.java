package com.kpitracking.repository;

import com.kpitracking.entity.BscWeightHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscWeightHistoryRepository extends JpaRepository<BscWeightHistory, UUID> {

    List<BscWeightHistory> findByScorecardIdOrderByChangedAtDesc(UUID scorecardId);
}
