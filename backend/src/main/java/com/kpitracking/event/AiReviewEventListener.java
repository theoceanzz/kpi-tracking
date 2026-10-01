package com.kpitracking.event;

import com.kpitracking.service.ai.review.SubmissionReviewService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Chạy lượt AI đọc bài nộp ở nền, SAU khi dòng {@code QUEUED} đã commit.
 *
 * <p>Không {@code @Transactional} ở đây (khác mẫu {@code NotificationEventListener}): lượt chạy vài chục
 * giây, và màn chấm đang poll phải thấy {@code RUNNING} rồi {@code DONE} ngay khi mỗi bước xong —
 * {@code ReviewRecorder} ghi mỗi trạng thái trong một transaction riêng.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AiReviewEventListener {

    private final SubmissionReviewService reviewService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("aiReviewExecutor")
    public void onRequested(AiReviewEvents.Requested event) {
        reviewService.execute(event.reviewId(), event.requesterEmail());
    }
}
