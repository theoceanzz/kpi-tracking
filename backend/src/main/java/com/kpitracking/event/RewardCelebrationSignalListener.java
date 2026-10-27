package com.kpitracking.event;

import com.kpitracking.entity.reward.RewardGrantItem;
import com.kpitracking.entity.reward.RewardProgramRunItem;
import com.kpitracking.entity.reward.RewardRedemption;
import com.kpitracking.entity.user.User;
import com.kpitracking.enums.reward.RedemptionStatus;
import com.kpitracking.repository.reward.RewardGrantItemRepository;
import com.kpitracking.repository.reward.RewardProgramRunItemRepository;
import com.kpitracking.repository.reward.RewardRedemptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Tín hiệu "có thưởng mới để ăn mừng" qua {@code /user/queue/celebrations} — chỉ là cú hích, không mang
 * dữ liệu: nhận được thì frontend gọi {@code GET /rewards/me/celebrations} (nguồn sự thật, xem
 * {@code RewardCelebrationService}). Mất tín hiệu (offline, đứt mạng) không sao — lần mở app sau vẫn lấy được.
 *
 * <p>Tách khỏi {@link RewardNotificationEventListener} và gửi THẲNG, không qua {@code NotificationDispatcher}:
 * tổ chức tắt chuông cho một mã sự kiện không được kéo theo tắt luôn hiệu ứng ăn mừng, và một người nhận
 * hỏng thông báo không được làm mất tín hiệu của người khác.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RewardCelebrationSignalListener {

    public static final String QUEUE = "/queue/celebrations";
    private static final Map<String, String> PAYLOAD = Map.of("type", "REWARD_CELEBRATION");

    private final SimpMessagingTemplate messagingTemplate;
    private final RewardGrantItemRepository grantItemRepository;
    private final RewardProgramRunItemRepository runItemRepository;
    private final RewardRedemptionRepository redemptionRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onGrantIssued(RewardEvents.GrantIssued event) {
        Set<User> recipients = new LinkedHashSet<>();
        // Người thưởng có tên trong danh sách nhận cũng nhận tín hiệu như mọi người nhận khác.
        for (RewardGrantItem item : grantItemRepository.findByGrantId(event.grantId())) recipients.add(item.getUser());
        signal(recipients);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onRunIssued(RewardEvents.RunIssued event) {
        Set<User> recipients = new LinkedHashSet<>();
        for (RewardProgramRunItem item : runItemRepository.findByRunIdOrderByOrderIndexAsc(event.runId())) {
            recipients.add(item.getUser());
        }
        signal(recipients);
    }

    /**
     * Chỉ khi đơn vừa chắc chắn về tay (duyệt / giao) và CHƯA được ăn mừng — đơn xong ngay trong request
     * của chính người đổi đã được đánh dấu lúc lưu, báo nữa là thừa.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public void onRedemptionSettled(RewardEvents.RedemptionSettled event) {
        RewardRedemption r = redemptionRepository.findById(event.redemptionId()).orElse(null);
        if (r == null || r.getCelebratedAt() != null) return;
        if (r.getStatus() != RedemptionStatus.APPROVED && r.getStatus() != RedemptionStatus.DELIVERED) return;
        signal(Set.of(r.getUser()));
    }

    private void signal(Set<User> users) {
        for (User u : users) {
            try {
                messagingTemplate.convertAndSendToUser(u.getEmail(), QUEUE, PAYLOAD);
            } catch (Exception e) {
                // Chỉ là cú hích — người này vẫn được ăn mừng lần tới mở app.
                log.debug("Không đẩy được tín hiệu ăn mừng cho {}", u.getId());
            }
        }
    }
}
