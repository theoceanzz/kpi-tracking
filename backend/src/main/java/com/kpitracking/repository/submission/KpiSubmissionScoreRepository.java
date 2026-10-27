package com.kpitracking.repository.submission;

import com.kpitracking.entity.submission.KpiSubmissionScore;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KpiSubmissionScoreRepository extends JpaRepository<KpiSubmissionScore, UUID> {

    Optional<KpiSubmissionScore> findBySubmissionIdAndEvaluatorId(UUID submissionId, UUID evaluatorId);

    List<KpiSubmissionScore> findBySubmissionIdInOrderByCreatedAtAsc(Collection<UUID> submissionIds);
}
