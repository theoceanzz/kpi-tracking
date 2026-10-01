package com.kpitracking.ai.review;

import dev.langchain4j.agentic.AgenticServices;
import dev.langchain4j.agentic.UntypedAgent;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Đồ thị của luồng AI đọc bài nộp và đề xuất điểm — cùng kiến trúc với {@code KeyGoAssistant} của khung
 * chat (đồ thị agentic + bước code thuần + agent {@code AiServices}), nhưng là đường RIÊNG: không qua khung
 * chat, không qua {@code AnswerValidator}.
 * <pre>
 * submission-review = sequence[
 *   context     (code)  đọc + cắt gọn dữ liệu (ReviewContextBuilder)
 *   evidence    (code)  tải + đọc tệp minh chứng: Word/Excel/PDF tại chỗ, ảnh/PDF scan bằng mô hình thị giác
 *   regulations (code)  trích đoạn quy chế / mô tả công việc (kho tìm kiếm lai sẵn có)
 *   measure     (code)  số do mã nguồn tính; chỉ tiêu chưa nộp xong luôn
 *   criteria    (agent) CriterionReviewAgent — một lời gọi mỗi chỉ tiêu, song song có trần
 *   summary     (agent) ReviewSummaryAgent — tóm tắt chung, mức tin cậy, thứ còn thiếu
 *   validate    (code)  mức tin cậy cuối ]
 * </pre>
 * Kiểm quyền, cờ và hạn mức đã chạy TRƯỚC khi vào đồ thị ({@code SubmissionReviewService.request}); lưu
 * kết quả chạy SAU, cùng chỗ ghi trạng thái.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubmissionReviewWorkflow {

    private final ReviewSteps steps;

    private UntypedAgent workflow;

    @PostConstruct
    void build() {
        workflow = AgenticServices.sequenceBuilder()
                .name("submission-review")
                .subAgents(
                        AgenticServices.agentAction(steps::context),
                        AgenticServices.agentAction(steps::evidence),
                        AgenticServices.agentAction(steps::regulations),
                        AgenticServices.agentAction(steps::measure),
                        AgenticServices.agentAction(steps::criteria),
                        AgenticServices.agentAction(steps::summary),
                        AgenticServices.agentAction(steps::validate))
                .build();
        log.info("Luồng AI đánh giá bài nộp: context → evidence → regulations → measure → criteria(agent) → summary(agent) → validate");
    }

    /** Chạy trọn một lượt; kết quả nằm trên chính {@code run}. */
    public void run(ReviewRun run) {
        workflow.invoke(Map.of(ReviewSteps.RUN, run));
    }
}
