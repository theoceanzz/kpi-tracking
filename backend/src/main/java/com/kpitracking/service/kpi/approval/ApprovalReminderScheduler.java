package com.kpitracking.service.kpi.approval;

import com.kpitracking.repository.KpiApprovalFlowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Nhắc người giữ bước khi một bước duyệt chờ quá N ngày (tuỳ chọn {@code reminderAfterDays} của
 * bước duyệt chỉ tiêu, mặc định 3). Nhắc lại sau mỗi N ngày nếu vẫn chưa xử lý. Thay cho việc
 * tự từ chối yêu cầu điều chỉnh sau 24h của luồng một cấp.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ApprovalReminderScheduler {

    private final KpiApprovalFlowRepository flowRepository;
    private final KpiApprovalChainService chainService;

    @Scheduled(cron = "0 10 * * * *")
    public void run() {
        Instant now = Instant.now();
        // Mốc rộng nhất (1 ngày); từng flow lọc chính xác theo số ngày của tổ chức mình.
        int reminded = 0;
        for (UUID flowId : flowRepository.findIdsWithStepPendingBefore(now.minus(Duration.ofDays(1)))) {
            try {
                if (chainService.remindIfOverdue(flowId, now)) reminded++;
            } catch (Exception e) {
                log.warn("Bỏ qua nhắc duyệt cho chuỗi {}: {}", flowId, e.getMessage());
            }
        }
        if (reminded > 0) log.info("Đã nhắc {} bước duyệt KPI chờ quá hạn", reminded);
    }
}
