package com.kpitracking.repository.feedback360;

import com.kpitracking.entity.feedback360.F360Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface F360EventRepository extends JpaRepository<F360Event, UUID> {

    @Query("SELECT e FROM F360Event e LEFT JOIN FETCH e.actor LEFT JOIN FETCH e.subject s LEFT JOIN FETCH s.user " +
           "WHERE e.campaign.id = :campaignId ORDER BY e.createdAt DESC")
    List<F360Event> findByCampaignId(@Param("campaignId") UUID campaignId);
}
