package com.kpitracking.service.ai.review;

import com.kpitracking.entity.AiSelfCheck;
import com.kpitracking.enums.AiReviewStatus;
import com.kpitracking.mapper.AiSubmissionReviewMapper;
import com.kpitracking.repository.AiSelfCheckRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Ghi trạng thái lượt tự soi — mỗi lần ghi một transaction riêng, cùng lý do với {@link ReviewRecorder}. */
@Component
@RequiredArgsConstructor
public class SelfCheckRecorder {

    private final AiSelfCheckRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiSelfCheck markRunning(UUID checkId) {
        AiSelfCheck check = repository.findById(checkId).orElse(null);
        if (check == null || check.getStatus() != AiReviewStatus.QUEUED) return null;
        check.setStatus(AiReviewStatus.RUNNING);
        return repository.save(check);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(UUID checkId, ReviewResults.SelfCheckResult r, ReviewContext ctx, int promptTokens,
                         int completionTokens, String modelName, Instant startedAt) {
        AiSelfCheck check = repository.findById(checkId).orElseThrow();
        check.setSummary(r.summary());
        check.setEvidenceQuotes(AiSubmissionReviewMapper.join(r.evidenceQuotes()));
        check.setStrengths(AiSubmissionReviewMapper.join(r.strengths()));
        check.setGaps(AiSubmissionReviewMapper.join(r.gaps()));
        check.setSuggestions(AiSubmissionReviewMapper.join(r.suggestions()));
        check.setBasisCitations(ReviewBasis.toJson(r.basis()));
        check.setUnreadableFiles(AiSubmissionReviewMapper.join(ctx.unreadableFiles()));
        int[] files = ctx.fileCounts();
        check.setFilesRead(files[0]);
        check.setFilesTotal(files[1]);
        if (ctx.criteriaSet() != null) {
            check.setCriteriaSetId(ctx.criteriaSet().id());
            check.setCriteriaSetVersion(ctx.criteriaSet().version());
        }
        check.setModelName(modelName);
        check.setPromptVersion(ReviewPrompts.PROMPT_VERSION);
        check.setPromptTokens(promptTokens);
        check.setCompletionTokens(completionTokens);
        finish(check, AiReviewStatus.DONE, null, startedAt);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID checkId, String error, Instant startedAt) {
        repository.findById(checkId).ifPresent(check -> finish(check, AiReviewStatus.FAILED, error, startedAt));
    }

    private void finish(AiSelfCheck check, AiReviewStatus status, String error, Instant startedAt) {
        Instant now = Instant.now();
        check.setStatus(status);
        check.setErrorMessage(error);
        check.setFinishedAt(now);
        if (startedAt != null) check.setDurationMs((int) Duration.between(startedAt, now).toMillis());
        repository.save(check);
    }
}
