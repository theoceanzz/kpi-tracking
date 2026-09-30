package com.kpitracking.event;

import com.kpitracking.service.ai.review.SelfCheckRunner;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Chạy lượt nhân viên tự soi bài ở nền, SAU khi dòng {@code QUEUED} đã commit — dùng chung executor với luồng
 * AI đánh giá bài nộp của quản lý (cùng trần luồng, không chặn thông báo).
 */
@Component
@RequiredArgsConstructor
public class AiSelfCheckEventListener {

    private final SelfCheckRunner runner;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("aiReviewExecutor")
    public void onRequested(AiSelfCheckEvents.Requested event) {
        runner.execute(event);
    }
}
