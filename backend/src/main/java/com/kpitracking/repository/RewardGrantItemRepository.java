package com.kpitracking.repository;

import com.kpitracking.entity.RewardGrantItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RewardGrantItemRepository extends JpaRepository<RewardGrantItem, UUID> {

    List<RewardGrantItem> findByGrantId(UUID grantId);

    List<RewardGrantItem> findByGrantIdIn(List<UUID> grantIds);
}
