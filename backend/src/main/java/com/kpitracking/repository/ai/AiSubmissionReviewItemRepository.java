package com.kpitracking.repository.ai;

import com.kpitracking.entity.ai.AiSubmissionReviewItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AiSubmissionReviewItemRepository extends JpaRepository<AiSubmissionReviewItem, UUID> {

    List<AiSubmissionReviewItem> findAllByReviewId(UUID reviewId);

    List<AiSubmissionReviewItem> findAllByReviewIdIn(Collection<UUID> reviewIds);
}
