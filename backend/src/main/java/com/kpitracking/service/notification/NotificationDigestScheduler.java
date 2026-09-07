package com.kpitracking.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Đẩy hàng đợi gom email đi theo nhịp.
 *
 * <p>Là bean RIÊNG chứ không phải method của {@link NotificationEmailDigestService}: mỗi
 * người nhận được gửi trong một transaction riêng, mà gọi nội bộ trong cùng một bean thì
 * Spring bỏ qua proxy nên chú thích {@code @Transactional} kia mất tác dụng — cùng lý do
 * với {@code CycleEvaluationMailer}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationDigestScheduler {

    private final NotificationEmailDigestService digestService;

    /**
     * Quét mỗi phút. Nhịp quét chỉ quyết định độ trễ tối đa so với lúc "chín", còn thời
     * điểm gửi thật do quiet-period/max-delay quyết định.
     */
    @Scheduled(fixedDelayString = "${app.notification.digest.scan-interval:PT1M}",
               initialDelayString = "PT30S")
    public void flushDigests() {
        List<UUID> recipients;
        try {
            recipients = digestService.findRecipientsReadyToSend(Instant.now());
        } catch (Exception e) {
            log.error("Không quét được hàng đợi gom email thông báo", e);
            return;
        }
        if (recipients.isEmpty()) return;

        log.info("Gửi email thông báo gộp cho {} người nhận", recipients.size());
        for (UUID userId : recipients) {
            try {
                digestService.flushRecipient(userId);
            } catch (Exception e) {
                // Một người nhận hỏng (địa chỉ sai, SMTP từ chối) không được chặn cả danh sách.
                log.error("Không gửi được email thông báo gộp cho người dùng {}", userId, e);
            }
        }
    }

    /** Dọn lịch sử đã gửi mỗi ngày để bảng không phình theo thời gian. */
    @Scheduled(cron = "0 30 2 * * *")
    public void purgeOldItems() {
        try {
            int removed = digestService.purgeOldSentItems();
            if (removed > 0) {
                log.info("Đã dọn {} mục thông báo email đã gửi quá hạn lưu", removed);
            }
        } catch (Exception e) {
            log.error("Không dọn được lịch sử gom email thông báo", e);
        }
    }
}
