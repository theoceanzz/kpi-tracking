package com.kpitracking.repository;

import com.kpitracking.entity.EvaluationPerspectiveScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EvaluationPerspectiveScoreRepository extends JpaRepository<EvaluationPerspectiveScore, UUID> {

    List<EvaluationPerspectiveScore> findByEvaluationId(UUID evaluationId);

    void deleteByEvaluationId(UUID evaluationId);
}
