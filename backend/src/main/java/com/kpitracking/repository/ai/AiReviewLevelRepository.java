package com.kpitracking.repository.ai;

import com.kpitracking.entity.ai.AiReviewLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AiReviewLevelRepository extends JpaRepository<AiReviewLevel, UUID> {

    List<AiReviewLevel> findByOrganizationIdOrderByPositionAsc(UUID organizationId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM AiReviewLevel l WHERE l.organizationId = :organizationId")
    void deleteByOrganizationId(@Param("organizationId") UUID organizationId);
}
