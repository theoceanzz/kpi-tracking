package com.kpitracking.repository.bsc;

import com.kpitracking.entity.bsc.BscWeightHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscWeightHistoryRepository extends JpaRepository<BscWeightHistory, UUID> {

    List<BscWeightHistory> findByScorecardIdOrderByChangedAtDesc(UUID scorecardId);
}
