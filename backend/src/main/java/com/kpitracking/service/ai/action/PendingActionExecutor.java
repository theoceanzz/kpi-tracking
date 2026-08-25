package com.kpitracking.service.ai.action;

import com.kpitracking.dto.request.kpi.RejectKpiRequest;
import com.kpitracking.dto.request.kpi.ReviewAdjustmentRequest;
import com.kpitracking.dto.request.submission.ReviewSubmissionRequest;
import com.kpitracking.enums.AdjustmentStatus;
import com.kpitracking.enums.SubmissionStatus;
import com.kpitracking.service.KpiAdjustmentService;
import com.kpitracking.service.KpiCriteriaService;
import com.kpitracking.service.KpiSubmissionService;
import com.kpitracking.service.ReminderService;
import com.kpitracking.service.ai.action.PendingAction.Decision;
import com.kpitracking.service.ai.action.PendingAction.Item;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Chạy một hành động sau khi người dùng đã xác nhận.
 *
 * <p><b>Gọi thẳng các dịch vụ nghiệp vụ, KHÔNG gọi lại qua REST và KHÔNG tự viết luật.</b> Mọi phép
 * kiểm quyền theo đơn vị, kiểm cấp bậc người duyệt so với người nộp, kiểm trạng thái hợp lệ đều
 * nằm sẵn trong dịch vụ và chạy lại đầy đủ ở đây. Đó là chủ đích: trợ lý phải đi qua đúng cánh cửa
 * mà giao diện đi qua, không được có cửa riêng. Chép luật sang đây là tạo ra bản thứ hai để trôi
 * lệch — đúng thứ vừa gây ra lỗ hổng {@code bulk-review}.
 *
 * <p><b>Vì sao lặp từng mục thay vì gọi bản hàng loạt của dịch vụ.</b> {@code bulkReview} nhận cả
 * lô trong MỘT giao dịch: một mục hỏng là cả lô lăn về. Với việc do trợ lý đề nghị, người dùng thà
 * biết "5 duyệt được, 2 không" còn hơn nhận một câu báo lỗi và không có gì xảy ra. Nên chạy từng
 * mục, gom lại, rồi báo cáo trung thực cả hai phía.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PendingActionExecutor {

    private final KpiSubmissionService submissionService;
    private final KpiCriteriaService kpiCriteriaService;
    private final KpiAdjustmentService adjustmentService;
    private final ReminderService reminderService;

    /**
     * Kết quả chạy, để tầng trên báo lại đúng sự thật.
     *
     * @param succeeded nhãn các mục chạy xong
     * @param failed    nhãn kèm lý do của các mục hỏng
     */
    public record Outcome(List<String> succeeded, List<String> failed) {}

    public Outcome execute(PendingAction action) {
        List<String> ok = new ArrayList<>();
        List<String> failed = new ArrayList<>();

        for (Item item : action.items()) {
            try {
                runOne(action, item);
                ok.add(item.label());
            } catch (Exception e) {
                // Một mục hỏng KHÔNG được chặn các mục còn lại — xem ghi chú ở đầu lớp.
                log.warn("Hành động {} hỏng ở mục {} ({}): {}",
                        action.kind(), item.id(), item.label(), e.getMessage());
                failed.add(item.label() + " — " + shortReason(e));
            }
        }
        log.info("Chạy hành động {} đã xác nhận: {} xong, {} hỏng",
                action.kind(), ok.size(), failed.size());
        return new Outcome(ok, failed);
    }

    private void runOne(PendingAction action, Item item) {
        boolean approve = action.decision() == Decision.APPROVE;
        switch (action.kind()) {
            case SUBMISSION_REVIEW -> submissionService.reviewSubmission(item.id(),
                    ReviewSubmissionRequest.builder()
                            .status(approve ? SubmissionStatus.APPROVED : SubmissionStatus.REJECTED)
                            .reviewNote(action.note())
                            .build());

            case KPI_CRITERIA_REVIEW -> {
                if (approve) {
                    kpiCriteriaService.approveKpi(item.id());
                } else {
                    kpiCriteriaService.rejectKpi(item.id(),
                            RejectKpiRequest.builder().reason(action.note()).build());
                }
            }

            case KPI_ADJUSTMENT_REVIEW -> adjustmentService.reviewRequest(item.id(),
                    ReviewAdjustmentRequest.builder()
                            .status(approve ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED)
                            .reviewerNote(action.note())
                            .build());

            // Nhắc nhở dùng cả hai khoá: chỉ tiêu và người nhận.
            case SEND_REMINDER -> reminderService.sendReminder(item.id(), item.relatedId());
        }
    }

    /** Lý do ngắn, đủ để người dùng hiểu vì sao một mục không chạy được. */
    private static String shortReason(Exception e) {
        String msg = e.getMessage();
        if (msg == null || msg.isBlank()) return "lỗi không xác định";
        return msg.length() <= 160 ? msg : msg.substring(0, 160) + "…";
    }
}
