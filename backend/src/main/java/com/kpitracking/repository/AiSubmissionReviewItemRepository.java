package com.kpitracking.repository;

import com.kpitracking.entity.AiSubmissionReviewItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiSubmissionReviewItemRepository extends JpaRepository<AiSubmissionReviewItem, UUID> {

    List<AiSubmissionReviewItem> findAllByReviewId(UUID reviewId);
}
