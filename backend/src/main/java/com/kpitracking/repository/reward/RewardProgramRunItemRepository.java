package com.kpitracking.repository.reward;

import com.kpitracking.entity.reward.RewardProgramRunItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardProgramRunItemRepository extends JpaRepository<RewardProgramRunItem, UUID> {

    List<RewardProgramRunItem> findByRunIdOrderByOrderIndexAsc(UUID runId);

    void deleteByRunId(UUID runId);
}
