package com.kpitracking.service;

import com.kpitracking.service.KpiCycleEvaluationService.PreparedCycleEmail;
import com.kpitracking.service.KpiCycleEvaluationService.SendCycleEvaluationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Gửi kết quả đánh giá kỳ cho nhân viên.
 *
 * <p>Là bean RIÊNG chứ không phải một method của {@link KpiCycleEvaluationService}:
 * lớp này KHÔNG có transaction, nên khi nó gọi sang service kia thì proxy của Spring
 * mới có tác dụng — đọc dữ liệu xong là đóng transaction, rồi mới đi gửi SMTP.
 * Gọi nội bộ trong cùng một bean sẽ bỏ qua proxy và giữ connection DB suốt lượt gửi.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CycleEvaluationMailer {

    private final KpiCycleEvaluationService cycleEvaluationService;
    private final EmailService emailService;

    /**
     * Gửi từng người một và đếm thành/bại thay vì dừng ở lỗi đầu tiên — một email
     * hỏng (sai địa chỉ, SMTP chặn) không nên chặn cả danh sách còn lại.
     */
    public SendCycleEvaluationResult send(UUID cycleId, UUID orgUnitId, List<UUID> userIds) {
        List<PreparedCycleEmail> prepared =
                cycleEvaluationService.prepareCycleEvaluationEmails(cycleId, orgUnitId, userIds);

        int sent = 0;
        List<String> failed = new ArrayList<>();

        for (PreparedCycleEmail item : prepared) {
            if (item.email() == null || item.email().isBlank()) {
                failed.add(item.recipientName());
                continue;
            }
            try {
                boolean ok = emailService.sendTemplated(
                        item.orgId(), "cycle_evaluation_result", item.email(), item.variables());
                if (ok) sent++; else failed.add(item.recipientName());
            } catch (Exception e) {
                log.error("Gửi kết quả đánh giá kỳ tới {} thất bại: {}", item.email(), e.getMessage());
                failed.add(item.recipientName());
            }
        }

        return new SendCycleEvaluationResult(sent, failed);
    }
}
