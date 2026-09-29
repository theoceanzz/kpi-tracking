package com.kpitracking.event;

import com.kpitracking.event.F360Events.SummaryRequestedEvent;
import com.kpitracking.repository.F360CampaignRepository;
import com.kpitracking.service.feedback360.F360AiSummaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

/**
 * Chạy tóm tắt AI 360 SAU khi đóng chiến dịch / ẩn nhận xét đã commit, trên luồng riêng — gọi model
 * mất vài giây mỗi người, không được giữ request của HR.
 *
 * <p>Luồng bất đồng bộ không có SecurityContext, mà listener ghi tiêu thụ token đọc người dùng từ
 * đó — nên dựng một context tối thiểu mang email người yêu cầu (hoặc người tạo chiến dịch) để token
 * được tính đúng người, rồi dọn đi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class F360SummaryEventListener {

    private final F360AiSummaryService summaryService;
    private final F360CampaignRepository campaignRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async
    public void onSummaryRequested(SummaryRequestedEvent event) {
        String email = event.actorEmail();
        if (email == null) {
            email = campaignRepository.findById(event.campaignId())
                    .map(c -> c.getCreatedBy() != null ? c.getCreatedBy().getEmail() : null).orElse(null);
        }
        try {
            if (email != null) {
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(email, null, List.of()));
            }
            summaryService.generate(event.campaignId(), event.subjectId());
        } catch (Exception e) {
            log.warn("Tóm tắt 360 cho chiến dịch {} thất bại: {}", event.campaignId(), e.getClass().getSimpleName());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
