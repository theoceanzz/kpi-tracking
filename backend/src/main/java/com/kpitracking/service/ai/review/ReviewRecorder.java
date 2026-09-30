package com.kpitracking.service.ai.review;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kpitracking.ai.review.ReviewRun;
import com.kpitracking.entity.AiSubmissionReview;
import com.kpitracking.entity.AiSubmissionReviewItem;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.AiSubmissionReviewItemRepository;
import com.kpitracking.repository.AiSubmissionReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi trạng thái và kết quả của một lượt — mỗi lần ghi một transaction RIÊNG.
 *
 * <p>Tách khỏi luồng chạy vì hai lẽ: màn chấm đang poll phải thấy {@code RUNNING} ngay (một transaction
 * bao trùm cả lượt thì chỉ thấy khi xong), và lượt lỗi giữa chừng vẫn phải ghi được {@code FAILED}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ReviewRecorder {

    private final AiSubmissionReviewRepository reviewRepository;
    private final AiSubmissionReviewItemRepository itemRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiSubmissionReview markRunning(UUID reviewId) {
        AiSubmissionReview review = reviewRepository.findById(reviewId).orElse(null);
        if (review == null || review.getStatus() != AiReviewStatus.QUEUED) return null;
        review.setStatus(AiReviewStatus.RUNNING);
        return reviewRepository.save(review);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(ReviewRun run, String modelName, Instant startedAt) {
        AiSubmissionReview review = reviewRepository.findById(run.getReviewId()).orElseThrow();
        java.util.Set<UUID> qualitative = new java.util.HashSet<>();
        for (ReviewContext.Criterion c : run.getContext().criteria()) if (c.qualitative()) qualitative.add(c.kpiCriteriaId());
        for (ReviewResults.CriterionResult r : run.getResults()) {
            itemRepository.save(AiSubmissionReviewItem.builder()
                    .reviewId(review.getId())
                    .kpiCriteriaId(r.kpiCriteriaId())
                    .kpiSubmissionId(r.kpiSubmissionId())
                    .summary(r.summary())
                    .qualityLevel(r.qualityLevel())
                    .qualityComment(r.qualityComment())
                    .evidenceQuotes(AiSubmissionReviewMapper.join(r.evidenceQuotes()))
                    .achievementPercent(r.achievementPercent())
                    .onTimePercent(r.onTimePercent())
                    .suggestedScore(r.suggestedScore())
                    .maxPoints(r.points().max())
                    .targetPoints(r.points().target())
                    .qualityPoints(r.points().quality())
                    .onTimePoints(r.points().onTime())
                    .systemPoints(r.points().system())
                    .qualitative(qualitative.contains(r.kpiCriteriaId()))
                    .strengths(AiSubmissionReviewMapper.join(r.strengths()))
                    .gaps(AiSubmissionReviewMapper.join(r.gaps()))
                    .suggestions(AiSubmissionReviewMapper.join(r.suggestions()))
                    .errorMessage(r.error())
                    .basisCitations(ReviewBasis.toJson(r.basis()))
                    .build());
        }
        review.setOverallSummary(run.getSummary());
        review.setConfidence(run.getConfidence());
        review.setMissingData(AiSubmissionReviewMapper.join(run.getMissingData()));
        review.setUnreadableFiles(AiSubmissionReviewMapper.join(run.getContext().unreadableFiles()));
        review.setCriteriaSnapshot(snapshot(run.getContext()));
        if (run.getContext().criteriaSet() != null) {
            review.setCriteriaSetId(run.getContext().criteriaSet().id());
            review.setCriteriaSetVersion(run.getContext().criteriaSet().version());
        }
        int[] files = run.getContext().fileCounts();
        review.setFilesRead(files[0]);
        review.setFilesTotal(files[1]);
        review.setModelName(modelName);
        review.setPromptVersion(ReviewPrompts.PROMPT_VERSION);
        review.setPromptTokens(run.getPromptTokens().get());
        review.setCompletionTokens(run.getCompletionTokens().get());
        finish(review, AiReviewStatus.DONE, null, startedAt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID reviewId, String message, Instant startedAt) {
        reviewRepository.findById(reviewId).ifPresent(review -> finish(review, AiReviewStatus.FAILED, message, startedAt));
    }

    private void finish(AiSubmissionReview review, AiReviewStatus status, String error, Instant startedAt) {
        Instant now = Instant.now();
        review.setStatus(status);
        review.setErrorMessage(error);
        review.setFinishedAt(now);
        if (startedAt != null) review.setDurationMs((int) Duration.between(startedAt, now).toMillis());
        reviewRepository.save(review);
    }

    /** Bộ tiêu chí tại thời điểm chấm — chỉ phần định nghĩa chỉ tiêu, không chép lại bài nộp. */
    private String snapshot(ReviewContext ctx) {
        try {
            List<Map<String, Object>> criteria = ctx.criteria().stream().map(c -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("kpiCriteriaId", c.kpiCriteriaId());
                m.put("name", c.name());
                m.put("qualitative", c.qualitative());
                m.put("targetValue", c.targetValue());
                m.put("minimumValue", c.minimumValue());
                m.put("unit", c.unit());
                m.put("weight", c.weight());
                m.put("deadline", c.deadline() == null ? null : c.deadline().toString());
                m.put("submissions", c.submissions().size());
                return m;
            }).toList();
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("weights", ctx.weights());
            root.put("scale", ReviewScoreCalculator.scaleOf(ctx));
            root.put("criteria", criteria);
            if (ctx.criteriaSet() != null) {
                root.put("criteriaSet", Map.of("id", ctx.criteriaSet().id(), "version", ctx.criteriaSet().version(),
                        "title", ctx.criteriaSet().title()));
            }
            root.put("excerpts", ctx.excerpts().stream().map(e -> e.document() + " › " + e.section()).toList());
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            log.warn("Không ghi được ảnh chụp bộ tiêu chí: {}", e.getMessage());
            return null;
        }
    }
}
