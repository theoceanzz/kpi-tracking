package com.kpitracking.repository.ai;

import com.kpitracking.entity.ai.AiCriteriaSetItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.UUID;

public interface AiCriteriaSetItemRepository extends JpaRepository<AiCriteriaSetItem, UUID> {

    List<AiCriteriaSetItem> findBySetIdOrderByPositionAsc(UUID setId);

    @Modifying
    void deleteBySetId(UUID setId);
}
