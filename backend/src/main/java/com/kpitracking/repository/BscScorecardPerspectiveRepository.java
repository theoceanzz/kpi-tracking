package com.kpitracking.repository;

import com.kpitracking.entity.BscScorecardPerspective;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BscScorecardPerspectiveRepository extends JpaRepository<BscScorecardPerspective, UUID> {

    List<BscScorecardPerspective> findByScorecardIdOrderByDisplayOrderAsc(UUID scorecardId);
}
