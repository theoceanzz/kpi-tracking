package com.kpitracking.service.wallet;

import com.kpitracking.repository.TopupOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Đánh dấu hết hạn các đơn nạp quá thời gian hiệu lực.
 *
 * <p>Dùng MỘT câu UPDATE có điều kiện chứ không load-rồi-ghi: điều kiện
 * {@code status = PENDING} nằm ngay trong WHERE nên đơn vừa được webhook chuyển
 * sang {@code PAID} sẽ không khớp và không bị đụng tới. Load-rồi-ghi sẽ mở ra
 * đúng khe hở đó — đọc lúc đơn còn PENDING, ghi sau khi webhook đã trả tiền.
 *
 * <p>Hết hạn KHÔNG có nghĩa là từ chối tiền: webhook cố ý vẫn ghi có cho đơn đã
 * {@code EXPIRED}. Trạng thái này chỉ để dọn màn hình của người dùng và để họ
 * biết mã cũ không còn được trông đợi nữa.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TopupExpiryScheduler {

    private final TopupOrderRepository orderRepository;

    @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT1M")
    @Transactional
    public void expireOverdueOrders() {
        int expired = orderRepository.expireOverdue(Instant.now());
        if (expired > 0) {
            log.info("Đã đánh dấu hết hạn {} đơn nạp tiền", expired);
        }
    }
}
