package com.kpitracking.repository.feedback360;

import com.kpitracking.entity.feedback360.F360CampaignQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface F360CampaignQuestionRepository extends JpaRepository<F360CampaignQuestion, UUID> {

    List<F360CampaignQuestion> findByCampaignId(UUID campaignId);
}
